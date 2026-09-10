import { BadRequestException, Injectable, NotFoundException, Optional, Inject, forwardRef } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

function toOrderResponse(order: any) {
  return {
    id: order.id,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    buyer: order.buyer
      ? {
          id: order.buyer.id,
          name: order.buyer.name,
          email: order.buyer.email,
        }
      : undefined,
    items: (order.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      unitPrice: it.unitPrice,
      discount: it.discount,
      quantity: it.quantity,
    })),
    delivery: order.delivery
      ? {
          id: order.delivery.id,
          orderId: order.delivery.orderId,
          type: order.delivery.type,
          addressId: order.delivery.addressId,
          scheduledDate: order.delivery.scheduledDate,
          timeWindow: order.delivery.timeWindow,
          status: order.delivery.status,
          deliveryFee: order.delivery.deliveryFee,
        }
      : null,
    payment: order.payment ?? null,
  };
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
    @Optional() @Inject(forwardRef(() => RealtimeGateway)) private readonly realtime?: RealtimeGateway,
  ) {}

  async findAll(dto: FilterOrdersDto) {
    const where: any = {};

    const status = dto.estadoNormalized;
    if (status) {
      where.status = status;
    }

    const start = dto.startDateNormalized;
    const end = dto.endDateNormalized;
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) {
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        where.createdAt.lte = e;
      }
    }

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: true, delivery: true, payment: true, buyer: true },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const mapped = orders.map(toOrderResponse);
    return buildPaginatedResponse(mapped, total, dto);
  }

  async updateStatus(adminId: string, orderId: string, dto: UpdateOrderStatusDto) {
    const normalized = dto.estadoNormalized;
    if (!normalized || !UpdateOrderStatusDto.isValid(normalized)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status',
          details: [
            {
              field: 'status',
              errors: [
                `status must be one of: awaiting_payment, paid, preparing, shipping, completed, cancelled`,
              ],
            },
          ],
        },
      });
    }
    const newStatus = UpdateOrderStatusDto.toEnum(normalized);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true, buyer: true },
    });
    if (!order) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }

    if (order.status === newStatus) {
      return toOrderResponse(order);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: { items: true, delivery: true, payment: true, buyer: true },
    });

    // Audit log via AuditService (English primary)
    await this.audit.register(adminId, 'update_order_status', 'order', orderId, {
      from: order.status,
      to: newStatus,
      status: newStatus,
    });

    // Notification to buyer (bilingual service method)
    try {
      const notif: any = this.notificationsService as any;
      if (typeof notif.create === 'function') {
        await notif.create(
          order.buyerId,
          'Order updated',
          `Your order #${orderId.slice(0, 8)} status was updated to ${normalized} (${newStatus})`,
        );
      } else if (typeof notif.criar === 'function') {
        await notif.criar(
          order.buyerId,
          'Order updated',
          `Your order #${orderId.slice(0, 8)} status was updated to ${normalized} (${newStatus})`,
        );
      }
    } catch {}

    try {
      this.realtime?.emitOrderStatusUpdated(order.buyerId, { orderId, status: newStatus, previousStatus: order.status, updatedBy: adminId });
    } catch {}

    return toOrderResponse(updated);
  }
}

// legacy alias
export const AdminPedidosService = AdminOrdersService;
