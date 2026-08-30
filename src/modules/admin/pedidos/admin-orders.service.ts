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
    comprador: order.buyer
      ? { id: order.buyer.id, nome: order.buyer.name, email: order.buyer.email }
      : undefined,
    buyer: order.buyer,
    itens: (order.items ?? []).map((it: any) => ({
      id: it.id,
      produto_id: it.productId,
      product_id: it.productId,
      productId: it.productId,
      nome_produto: it.productName,
      productName: it.productName,
      preco_unitario: it.unitPrice,
      unitPrice: it.unitPrice,
      desconto: it.discount,
      discount: it.discount,
      quantidade: it.quantity,
      quantity: it.quantity,
    })),
    entrega: order.delivery
      ? {
          id: order.delivery.id,
          pedido_id: order.delivery.orderId,
          orderId: order.delivery.orderId,
          tipo: order.delivery.type,
          type: order.delivery.type,
          endereco_id: order.delivery.addressId,
          addressId: order.delivery.addressId,
          data_agendada: order.delivery.scheduledDate,
          scheduledDate: order.delivery.scheduledDate,
          janela_horario: order.delivery.timeWindow,
          timeWindow: order.delivery.timeWindow,
          estado: order.delivery.status,
          status: order.delivery.status,
          taxa_entrega: order.delivery.deliveryFee,
          deliveryFee: order.delivery.deliveryFee,
        }
      : null,
    delivery: order.delivery,
    pagamento: order.payment ?? null,
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
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Estado inválido',
          detalhes: [
            {
              campo: 'estado',
              erros: [
                `estado deve ser um de: aguardando_pagamento, pago, em_preparacao, em_entrega, concluido, cancelado`,
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
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

    // Audit log via AuditoriaService
    await this.auditoria.registar(adminId, 'atualizar_estado_pedido', 'pedido', orderId, {
      de: order.status,
      para: newStatus,
      estado: newStatus,
    });

    // Notificação ao comprador
    try {
      await this.notificationsService.criar(
        order.buyerId,
        'Pedido atualizado',
        `O estado do seu pedido #${orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
      );
    } catch {}

    return toOrderResponse(updated);
  }
}
