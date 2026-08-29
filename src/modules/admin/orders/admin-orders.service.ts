import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

function toOrderResponse(order: any) {
  return {
    id: order.id,
    order_id: order.id,
    pedido_id: order.id,
    buyerId: order.buyerId,
    buyer_id: order.buyerId,
    comprador_id: order.buyerId,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    delivery_fee: order.deliveryFee,
    taxa_entrega: order.deliveryFee,
    total: order.total,
    status: order.status,
    estado: order.status,
    createdAt: order.createdAt,
    created_at: order.createdAt,
    criado_em: order.createdAt,
    buyer: order.buyer,
    comprador: order.buyer ? { id: order.buyer.id, name: order.buyer.name, nome: order.buyer.name, email: order.buyer.email } : undefined,
    items: (order.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      product_id: it.productId,
      produto_id: it.productId,
      productName: it.productName,
      nome_produto: it.productName,
      unitPrice: it.unitPrice,
      preco_unitario: it.unitPrice,
      discount: it.discount,
      desconto: it.discount,
      quantity: it.quantity,
      quantidade: it.quantity,
    })),
    itens: (order.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      product_id: it.productId,
      produto_id: it.productId,
      productName: it.productName,
      nome_produto: it.productName,
      unitPrice: it.unitPrice,
      preco_unitario: it.unitPrice,
      discount: it.discount,
      desconto: it.discount,
      quantity: it.quantity,
      quantidade: it.quantity,
    })),
    delivery: order.delivery,
    entrega: order.delivery
      ? {
          id: order.delivery.id,
          orderId: order.delivery.orderId,
          pedido_id: order.delivery.orderId,
          type: order.delivery.type,
          tipo: order.delivery.type,
          addressId: order.delivery.addressId,
          endereco_id: order.delivery.addressId,
          scheduledDate: order.delivery.scheduledDate,
          data_agendada: order.delivery.scheduledDate,
          timeWindow: order.delivery.timeWindow,
          janela_horario: order.delivery.timeWindow,
          status: order.delivery.status,
          estado: order.delivery.status,
          deliveryFee: order.delivery.deliveryFee,
          taxa_entrega: order.delivery.deliveryFee,
        }
      : null,
    payment: order.payment ?? null,
    pagamento: order.payment ?? null,
  };
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
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
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Estado inválido',
          detalhes: [{ campo: 'estado', erros: [`estado deve ser um de: aguardando_pagamento, pago, em_preparacao, em_entrega, concluido, cancelado`] }],
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

    // Audit log via AuditService (English primary)
    await this.audit.register(adminId, 'update_order_status', 'order', orderId, { from: order.status, to: newStatus, status: newStatus, de: order.status, para: newStatus, estado: newStatus });

    // Notification to buyer (bilingual service method)
    try {
      const notif: any = this.notificationsService as any;
      if (typeof notif.create === 'function') {
        await notif.create(
          order.buyerId,
          'Pedido atualizado',
          `O estado do seu pedido #${orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
        );
      } else if (typeof notif.criar === 'function') {
        await notif.criar(
          order.buyerId,
          'Pedido atualizado',
          `O estado do seu pedido #${orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
        );
      }
    } catch {}

    return toOrderResponse(updated);
  }
}

// legacy alias
export const AdminPedidosService = AdminOrdersService;
