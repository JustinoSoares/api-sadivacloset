import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterMembersDto } from './dto/filter-members.dto';

function toMemberResponse(
  user: any,
  stats: { totalOrders: number; totalSpentGross: number; totalSpentPaid: number },
) {
  return {
    id: user.id,
    name: user.name,
    nome: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    criadoEm: user.createdAt,
    isActive: user.isActive,
    ativo: user.isActive,
    totalOrders: stats.totalOrders,
    totalPedidos: stats.totalOrders,
    total_pedidos: stats.totalOrders,
    nOrders: stats.totalOrders,
    nPedidos: stats.totalOrders,
    n_pedidos: stats.totalOrders,
    ordersCount: stats.totalOrders,
    pedidosCount: stats.totalOrders,
    totalSpent: stats.totalSpentPaid,
    totalGasto: stats.totalSpentPaid,
    total_gasto: stats.totalSpentPaid,
    totalSpentGross: stats.totalSpentGross,
    totalGastoBruto: stats.totalSpentGross,
    total_gasto_bruto: stats.totalSpentGross,
  };
}

@Injectable()
export class AdminMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: FilterMembersDto) {
    const search = dto.searchNormalized;
    const where: any = { role: Role.BUYER };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, createdAt: true, isActive: true, role: true },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    if (users.length === 0) {
      return buildPaginatedResponse([], total, dto);
    }

    const ids = users.map((u) => u.id);

    const [groupAll, groupPaid] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['buyerId'],
        where: { buyerId: { in: ids } },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['buyerId'],
        where: { buyerId: { in: ids }, status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    const mapAll = new Map<string, { count: number; sum: number }>();
    for (const g of groupAll as any[]) {
      mapAll.set(g.buyerId, { count: g._count._all ?? 0, sum: g._sum.total ?? 0 });
    }
    const mapPaid = new Map<string, { count: number; sum: number }>();
    for (const g of groupPaid as any[]) {
      mapPaid.set(g.buyerId, { count: g._count._all ?? 0, sum: g._sum.total ?? 0 });
    }

    const mapped = users.map((u) => {
      const all = mapAll.get(u.id) ?? { count: 0, sum: 0 };
      const paid = mapPaid.get(u.id) ?? { count: 0, sum: 0 };
      return toMemberResponse(u, {
        totalOrders: all.count,
        totalSpentGross: all.sum,
        totalSpentPaid: paid.sum,
      });
    });

    return buildPaginatedResponse(mapped, total, dto);
  }

  async findOrdersByMember(memberId: string, dto: PaginationDto) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true },
    });
    if (!member || member.role !== Role.BUYER) {
      const exists = await this.prisma.user.findUnique({ where: { id: memberId } });
      if (!exists) {
        throw new NotFoundException({
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Membro não encontrado' },
        });
      }
      if (exists.role !== Role.BUYER) {
        throw new NotFoundException({
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Membro não encontrado (não é comprador)' },
        });
      }
    }

    const where = { buyerId: memberId };

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

    const mapped = orders.map((order: any) => ({
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
      criado_em: order.createdAt,
      items: order.items,
      itens: order.items,
      delivery: order.delivery,
      entrega: order.delivery,
      payment: order.payment,
      pagamento: order.payment,
    }));

    return buildPaginatedResponse(mapped, total, dto);
  }

  // legacy alias
  async findPedidosByMembro(membroId: string, dto: PaginationDto) {
    return this.findOrdersByMember(membroId, dto);
  }
}

// legacy export
export const AdminMembrosService = AdminMembersService;
