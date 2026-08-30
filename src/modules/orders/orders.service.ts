import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

function toOrderResponse(order: any) {
  return {
    id: order.id,
    pedido_id: order.id,
    order_id: order.id,
    comprador_id: order.buyerId,
    buyer_id: order.buyerId,
    buyerId: order.buyerId,
    subtotal: order.subtotal,
    taxa_entrega: order.deliveryFee,
    delivery_fee: order.deliveryFee,
    deliveryFee: order.deliveryFee,
    total: order.total,
    estado: order.status,
    status: order.status,
    criado_em: order.createdAt,
    created_at: order.createdAt,
    createdAt: order.createdAt,
    itens: (order.items ?? []).map((it: any) => ({
      id: it.id,
      pedido_id: it.orderId,
      order_id: it.orderId,
      orderId: it.orderId,
      produto_id: it.productId,
      product_id: it.productId,
      productId: it.productId,
      nome_produto: it.productName,
      product_name: it.productName,
      productName: it.productName,
      preco_unitario: it.unitPrice,
      unit_price: it.unitPrice,
      unitPrice: it.unitPrice,
      desconto: it.discount,
      discount: it.discount,
      quantidade: it.quantity,
      quantity: it.quantity,
    })),
    items: (order.items ?? []).map((it: any) => ({
      id: it.id,
      orderId: it.orderId,
      productId: it.productId,
      productName: it.productName,
      unitPrice: it.unitPrice,
      discount: it.discount,
      quantity: it.quantity,
    })),
    entrega: order.delivery
      ? {
          id: order.delivery.id,
          pedido_id: order.delivery.orderId,
          order_id: order.delivery.orderId,
          orderId: order.delivery.orderId,
          tipo: order.delivery.type,
          type: order.delivery.type,
          endereco_id: order.delivery.addressId,
          address_id: order.delivery.addressId,
          addressId: order.delivery.addressId,
          data_agendada: order.delivery.scheduledDate,
          scheduled_date: order.delivery.scheduledDate,
          scheduledDate: order.delivery.scheduledDate,
          janela_horario: order.delivery.timeWindow,
          time_window: order.delivery.timeWindow,
          timeWindow: order.delivery.timeWindow,
          estado: order.delivery.status,
          status: order.delivery.status,
          taxa_entrega: order.delivery.deliveryFee,
          delivery_fee: order.delivery.deliveryFee,
          deliveryFee: order.delivery.deliveryFee,
          instrucoes: order.delivery.instructions ?? null,
          instructions: order.delivery.instructions ?? null,
        }
      : null,
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
    pagamento: order.payment
      ? {
          id: order.payment.id,
          pedido_id: order.payment.orderId,
          order_id: order.payment.orderId,
          orderId: order.payment.orderId,
          metodo: order.payment.method,
          method: order.payment.method,
          valor: order.payment.amount,
          amount: order.payment.amount,
          estado: order.payment.status,
          status: order.payment.status,
          referencia_externa: order.payment.externalReference ?? null,
          external_reference: order.payment.externalReference ?? null,
          externalReference: order.payment.externalReference ?? null,
          comprovativo_url: order.payment.receiptUrl ?? null,
          receipt_url: order.payment.receiptUrl ?? null,
          receiptUrl: order.payment.receiptUrl ?? null,
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        erro: { codigo: 'PEDIDO_JA_CANCELADO', mensagem: 'Pedido já cancelado' },
      });
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        erro: {
          codigo: 'PEDIDO_NAO_CANCELAVEL',
          mensagem: 'Pedido já concluído não pode ser cancelado',
        },
      });
    }

    // Só permitido se Entrega.estado ainda não for em_entrega
    // Mapeia "em_entrega" para DeliveryStatus.ON_THE_WAY (a_caminho) e também bloqueia DELIVERED
    // Também bloqueia se OrderStatus.SHIPPING (em_entrega) — compatibilidade
    const deliveryStatus = order.delivery?.status;
    if (
      deliveryStatus === DeliveryStatus.ON_THE_WAY ||
      deliveryStatus === DeliveryStatus.DELIVERED ||
      order.status === OrderStatus.SHIPPING
    ) {
      throw new BadRequestException({
        erro: {
          codigo: 'ENTREGA_EM_CURSO',
          mensagem: 'Não é possível cancelar pedido com entrega em curso (a caminho / em entrega)',
        },
      });
    }
    if (deliveryStatus === DeliveryStatus.CANCELLED) {
      throw new BadRequestException({
        erro: { codigo: 'ENTREGA_JA_CANCELADA', mensagem: 'Entrega já cancelada' },
      });
    }

    // Transação: repõe stock + atualiza pedido e entrega
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
        // fallback se include não trouxe
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
      });
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        erro: {
          codigo: 'PEDIDO_CANCELADO',
          mensagem: 'Não é possível alterar entrega de pedido cancelado',
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
            erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endereço não encontrado' },
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
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Erro de validação',
            detalhes: [{ campo: 'data_agendada', erros: ['data_agendada inválida'] }],
          },
        });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const schedOnly = new Date(d);
      schedOnly.setHours(0, 0, 0, 0);
      if (schedOnly < today) {
        throw new BadRequestException({
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Erro de validação',
            detalhes: [
              { campo: 'data_agendada', erros: ['data_agendada não pode ser no passado'] },
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
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Erro de validação',
            detalhes: [{ campo: 'janela_horario', erros: ['janela_horario não pode ser vazia'] }],
          },
        });
      }
      timeWindow = t;
    }

    let instructions: string | null | undefined = undefined;
    if (data.instrucoes !== undefined) {
      instructions = data.instrucoes;
    }

    // Se não há entrega, cria; se há, atualiza apenas campos fornecidos
    if (!order.delivery) {
      // exige data_agendada e janela_horario para criar
      if (!scheduledDate || !timeWindow) {
        throw new BadRequestException({
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Erro de validação',
            detalhes: [
              ...(!scheduledDate
                ? [{ campo: 'data_agendada', erros: ['data_agendada é obrigatória'] }]
                : []),
              ...(!timeWindow
                ? [{ campo: 'janela_horario', erros: ['janela_horario é obrigatória'] }]
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

    // update existente — bloqueia se já a caminho/entregue
    if (
      order.delivery.status === DeliveryStatus.ON_THE_WAY ||
      order.delivery.status === DeliveryStatus.DELIVERED
    ) {
      throw new BadRequestException({
        erro: { codigo: 'ENTREGA_EM_CURSO', mensagem: 'Não é possível alterar entrega em curso' },
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
