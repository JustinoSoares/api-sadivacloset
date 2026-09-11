import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

async function enrichOrder(prisma: any, order: any) {
  // Enriquecer delivery.address + deliveryZone e items.product
  let deliveryEnriched: any = null;
  if (order.delivery) {
    const d = order.delivery;
    let address: any = null;
    let deliveryZone: any = null;
    if (d.addressId) {
      address = await prisma.address.findUnique({ where: { id: d.addressId } });
      if (address) {
        const zone = await prisma.deliveryZone.findUnique({ where: { neighborhood: address.neighborhood } });
        if (zone) deliveryZone = { id: zone.id, neighborhood: zone.neighborhood, price: zone.price };
        else {
          const prefs = await prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
          if (prefs) deliveryZone = { id: 'default', neighborhood: address.neighborhood, price: prefs.defaultDeliveryFee };
        }
      }
    } else if (d.deliveryFee !== undefined) {
      // tenta deduzir zona pelo preço? deixa null
    }
    deliveryEnriched = {
      id: d.id,
      orderId: d.orderId,
      type: d.type,
      addressId: d.addressId,
      address: address ? { ...address, deliveryZone } : null,
      deliveryZone,
      scheduledDate: d.scheduledDate,
      timeWindow: d.timeWindow,
      status: d.status,
      deliveryFee: d.deliveryFee,
      instructions: d.instructions ?? null,
    };
  }

  const itemsEnriched = await Promise.all(
    (order.items ?? []).map(async (it: any) => {
      let product: any = null;
      try {
        product = await prisma.product.findUnique({ where: { id: it.productId } });
      } catch {}
      return {
        id: it.id,
        orderId: it.orderId,
        productId: it.productId,
        productName: it.productName,
        unitPrice: it.unitPrice,
        discount: it.discount,
        quantity: it.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              description: product.description,
              image: product.image,
              category: product.category,
              size: product.size,
              condition: product.condition,
              stock: product.stock,
              price: product.price,
              discount: product.discount,
            }
          : null,
      };
    }),
  );

  return {
    id: order.id,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    createdAt: order.createdAt,
    items: itemsEnriched,
    delivery: deliveryEnriched,
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
    buyer: order.buyer
      ? {
          id: order.buyer.id,
          name: order.buyer.name,
          email: order.buyer.email,
        }
      : undefined,
  };
}

function toOrderResponse(order: any) {
  // fallback sync (sem enriquecimento) - usado apenas internamente se necessário
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
      product: it.product ?? null,
    })),
    delivery: order.delivery
      ? {
          id: order.delivery.id,
          orderId: order.delivery.orderId,
          type: order.delivery.type,
          addressId: order.delivery.addressId,
          address: order.delivery.address ?? null,
          deliveryZone: order.delivery.deliveryZone ?? null,
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
    buyer: order.buyer
      ? { id: order.buyer.id, name: order.buyer.name, email: order.buyer.email }
      : undefined,
  };
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true, payment: true, buyer: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Pedido não encontrado.' },
      });
    }
    return enrichOrder(this.prisma, order);
  }

  async findAllPaginated(buyerId: string, dto: PaginationDto) {
    const where = { buyerId };
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
    const mapped = await Promise.all(orders.map((o) => enrichOrder(this.prisma, o)));
    return buildPaginatedResponse(mapped, total, dto);
  }

  async cancel(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, delivery: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Pedido não encontrado.' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        error: { code: 'ORDER_ALREADY_CANCELLED', message: 'Este pedido já foi cancelado.' },
      });
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        error: {
          code: 'ORDER_NOT_CANCELLABLE',
          message: 'Este pedido já foi concluído e não pode ser cancelado.',
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
          message: 'Não é possível cancelar. A entrega já está em andamento.',
        },
      });
    }
    if (deliveryStatus === DeliveryStatus.CANCELLED) {
      throw new BadRequestException({
        error: { code: 'DELIVERY_ALREADY_CANCELLED', message: 'Entrega já cancelada.' },
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
        include: { items: true, delivery: true, payment: true, buyer: true },
      });

      return refreshed;
    }).then((order) => enrichOrder(this.prisma, order));
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
        error: { code: 'NOT_FOUND', message: 'Pedido não encontrado.' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        error: {
          code: 'ORDER_CANCELLED',
          message: 'Não é possível alterar entrega de pedido cancelado.',
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
            error: { code: 'NOT_FOUND', message: 'Endereço não encontrado.' },
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
            message: 'Dados inválidos. Verifique os campos.',
            details: [{ field: 'scheduledDate', errors: ['Data agendada inválida.'] }],
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
            message: 'Dados inválidos. Verifique os campos.',
            details: [
              { field: 'scheduledDate', errors: ['A data agendada não pode ser no passado.'] },
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
            message: 'Dados inválidos. Verifique os campos.',
            details: [{ field: 'timeWindow', errors: ['Janela de horário é obrigatória.'] }],
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
            message: 'Dados inválidos. Verifique os campos.',
            details: [
              ...(!scheduledDate
                ? [{ field: 'scheduledDate', errors: ['Data agendada é obrigatória.'] }]
                : []),
              ...(!timeWindow
                ? [{ field: 'timeWindow', errors: ['Janela de horário é obrigatória.'] }]
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
        include: { items: true, delivery: true, payment: true, buyer: true },
      });
      return enrichOrder(this.prisma, refreshed);
    }

    if (
      order.delivery.status === DeliveryStatus.ON_THE_WAY ||
      order.delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException({
        error: { code: 'DELIVERY_IN_PROGRESS', message: 'Não é possível alterar entrega em andamento.' },
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
      include: { items: true, delivery: true, payment: true, buyer: true },
    });
    return enrichOrder(this.prisma, refreshed);
  }
}
