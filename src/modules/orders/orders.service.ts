import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

function toOrderResponse(order: any) {
  return {
    id: order.id,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    items: (order.items ?? []).map((it: any) => ({
      id: it.id,
      orderId: it.orderId,
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
          instructions: order.delivery.instructions ?? null,
        }
      : null,
    payment: order.payment
      ? {
          id: order.payment.id,
          orderId: order.payment.orderId,
          method: order.payment.method,
          amount: order.payment.amount,
          status: order.payment.status,
          externalReference: order.payment.externalReference ?? null,
          receiptUrl: order.payment.receiptUrl ?? null,
          providerTxId: order.payment.providerTxId ?? null,
          bridpayIntentId: order.payment.bridpayIntentId ?? null,
          bridpayMerchantTxId: order.payment.bridpayMerchantTxId ?? null,
          providerDetails: order.payment.providerDetails ?? null,
          phoneNumber: order.payment.phoneNumber ?? null,
          iban: order.payment.iban ?? null,
        }
      : null,
  };
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true, payment: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    return toOrderResponse(order);
  }

  async findAllPaginated(buyerId: string, dto: PaginationDto) {
    const where = { buyerId };
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: true, delivery: true, payment: true },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);
    const mapped = orders.map(toOrderResponse);
    return buildPaginatedResponse(mapped, total, dto);
  }

  async cancel(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        error: { code: 'ORDER_ALREADY_CANCELLED', message: 'Order already cancelled' },
      });
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        error: {
          code: 'ORDER_NOT_CANCELLABLE',
          message: 'Completed order cannot be cancelled',
        },
      });
    }

    const deliveryStatus = order.delivery?.status;
    if (
      deliveryStatus === DeliveryStatus.ON_THE_WAY ||
      deliveryStatus === DeliveryStatus.DELIVERED ||
      order.status === OrderStatus.SHIPPING
    ) {
      throw new BadRequestException({
        error: {
          code: 'DELIVERY_IN_PROGRESS',
          message: 'Cannot cancel order with delivery in progress',
        },
      });
    }
    if (deliveryStatus === DeliveryStatus.CANCELLED) {
      throw new BadRequestException({
        error: { code: 'DELIVERY_ALREADY_CANCELLED', message: 'Delivery already cancelled' },
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: { items: true, delivery: true, payment: true },
      });

      if (updated.delivery) {
        await tx.delivery.update({
          where: { id: updated.delivery.id },
          data: { status: DeliveryStatus.CANCELLED },
        });
      } else if (order.delivery) {
        await tx.delivery.update({
          where: { id: order.delivery.id },
          data: { status: DeliveryStatus.CANCELLED },
        });
      }

      const refreshed = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, delivery: true, payment: true },
      });

      return toOrderResponse(refreshed);
    });
  }

  async upsertDelivery(
    buyerId: string,
    orderId: string,
    data: {
      enderecoId?: string;
      dataAgendada?: string;
      janelaHorario?: string;
      instrucoes?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        error: {
          code: 'ORDER_CANCELLED',
          message: 'Cannot update delivery of cancelled order',
        },
      });
    }

    let addressId: string | null | undefined = undefined;
    if (data.enderecoId !== undefined) {
      if (data.enderecoId === null) {
        addressId = null;
      } else {
        const address = await this.prisma.address.findUnique({ where: { id: data.enderecoId } });
        if (!address || address.buyerId !== buyerId) {
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Address not found' },
          });
        }
        addressId = address.id;
      }
    }

    let scheduledDate: Date | undefined = undefined;
    if (data.dataAgendada !== undefined) {
      const d = new Date(data.dataAgendada);
      if (isNaN(d.getTime())) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation error',
            details: [{ field: 'scheduledDate', errors: ['scheduledDate is invalid'] }],
          },
        });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const schedOnly = new Date(d);
      schedOnly.setHours(0, 0, 0, 0);
      if (schedOnly < today) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation error',
            details: [
              { field: 'scheduledDate', errors: ['scheduledDate cannot be in the past'] },
            ],
          },
        });
      }
      scheduledDate = d;
    }

    let timeWindow: string | undefined = undefined;
    if (data.janelaHorario !== undefined) {
      const t = data.janelaHorario.trim();
      if (!t) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation error',
            details: [{ field: 'timeWindow', errors: ['timeWindow cannot be empty'] }],
          },
        });
      }
      timeWindow = t;
    }

    let instructions: string | null | undefined = undefined;
    if (data.instrucoes !== undefined) {
      instructions = data.instrucoes;
    }

    if (!order.delivery) {
      if (!scheduledDate || !timeWindow) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation error',
            details: [
              ...(!scheduledDate
                ? [{ field: 'scheduledDate', errors: ['scheduledDate is required'] }]
                : []),
              ...(!timeWindow
                ? [{ field: 'timeWindow', errors: ['timeWindow is required'] }]
                : []),
            ],
          },
        });
      }
      const created = await this.prisma.delivery.create({
        data: {
          orderId,
          type: 'HOME_DELIVERY' as any,
          addressId: addressId ?? null,
          scheduledDate: scheduledDate!,
          timeWindow: timeWindow!,
          status: DeliveryStatus.SCHEDULED,
          deliveryFee: order.deliveryFee ?? 0,
          instructions: instructions ?? null,
        },
      });
      const refreshed = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, delivery: true, payment: true },
      });
      return toOrderResponse(refreshed);
    }

    if (
      order.delivery.status === DeliveryStatus.ON_THE_WAY ||
      order.delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException({
        error: { code: 'DELIVERY_IN_PROGRESS', message: 'Cannot update delivery in progress' },
      });
    }

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id: order.delivery.id },
      data: {
        ...(addressId !== undefined ? { addressId } : {}),
        ...(scheduledDate !== undefined ? { scheduledDate } : {}),
        ...(timeWindow !== undefined ? { timeWindow } : {}),
        ...(instructions !== undefined ? { instructions } : {}),
      },
    });

    const refreshed = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true, payment: true },
    });
    return toOrderResponse(refreshed);
  }
}
