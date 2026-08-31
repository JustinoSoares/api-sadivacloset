import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

function toDeliveryResponse(delivery: any) {
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    type: delivery.type,
    addressId: delivery.addressId,
    scheduledDate: delivery.scheduledDate,
    timeWindow: delivery.timeWindow,
    status: delivery.status,
    deliveryFee: delivery.deliveryFee,
    instructions: delivery.instructions ?? null,
    order: delivery.order
      ? {
          id: delivery.order.id,
          buyerId: delivery.order.buyerId,
          status: delivery.order.status,
          total: delivery.order.total,
          createdAt: delivery.order.createdAt,
        }
      : undefined,
  };
}

@Injectable()
export class AdminDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async findAll(dto: FilterDeliveriesDto) {
    const where: any = {};

    const status = dto.estadoNormalized;
    if (status) {
      where.status = status;
    }

    const start = dto.startDateNormalized;
    const end = dto.endDateNormalized;
    if (start || end) {
      where.scheduledDate = {};
      if (start) where.scheduledDate.gte = new Date(start);
      if (end) {
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = e;
      }
    }

    const [total, deliveries] = await Promise.all([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        include: { order: true, address: true },
        orderBy: { scheduledDate: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const mapped = deliveries.map(toDeliveryResponse);
    return buildPaginatedResponse(mapped, total, dto);
  }

  async updateStatus(adminId: string, deliveryId: string, dto: UpdateDeliveryStatusDto) {
    const normalized = dto.estadoNormalized;
    if (!normalized || !UpdateDeliveryStatusDto.isValid(normalized)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid status',
          details: [
            {
              field: 'status',
              errors: [`status must be one of: scheduled, on_the_way, delivered, failed, cancelled`],
            },
          ],
        },
      });
    }
    const newStatus = UpdateDeliveryStatusDto.toEnum(normalized);

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Delivery not found' },
      });
    }

    if (delivery.status === newStatus) {
      return toDeliveryResponse(delivery);
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: newStatus },
      include: { order: true, address: true },
    });

    await this.audit.register(adminId, 'update_delivery_status', 'delivery', deliveryId, {
      from: delivery.status,
      to: newStatus,
      status: newStatus,
    });

    try {
      const notif: any = this.notificationsService as any;
      if (typeof notif.create === 'function') {
        await notif.create(
          delivery.order.buyerId,
          'Delivery updated',
          `Delivery for order #${delivery.orderId.slice(0, 8)} status updated to ${normalized} (${newStatus})`,
        );
      } else if (typeof notif.criar === 'function') {
        await notif.criar(
          delivery.order.buyerId,
          'Delivery updated',
          `Delivery for order #${delivery.orderId.slice(0, 8)} status updated to ${normalized} (${newStatus})`,
        );
      }
    } catch {}

    return toDeliveryResponse(updated);
  }
}

// legacy alias
export const AdminEntregasService = AdminDeliveriesService;
