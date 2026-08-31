import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
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
    private readonly auditoria: AuditoriaService,
  ) {}

  async findAll(dto: FilterOrdersDto) {
    const where: any = {};

    const estado = dto.estadoNormalized;
    if (estado) {
      where.status = estado;
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

    await this.auditoria.registar(adminId, 'update_order_status', 'order', orderId, {
      from: order.status,
      to: newStatus,
      status: newStatus,
    });

    // Notificação ao comprador
    try {
      await this.notificationsService.create(
        order.buyerId,
        'Order updated',
        `Your order #${orderId.slice(0, 8)} status was updated to ${normalized} (${newStatus})`,
      );
    } catch {}

    return toOrderResponse(updated);
  }
}
