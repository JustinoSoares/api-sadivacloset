import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';

function toMemberResponse(
  user: any,
  stats: { totalOrders: number; totalSpentGross: number; totalSpentPaid: number },
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    isActive: user.isActive,
    totalOrders: stats.totalOrders,
    totalSpent: stats.totalSpentPaid,
    totalSpentGross: stats.totalSpentGross,
  };
}

@Injectable()
export class AdminMembrosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: FilterMembrosDto) {
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

    // Agregação real via comprador_id (buyerId) – nunca por nome
    const [groupAll, groupPago] = await Promise.all([
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
    const mapPago = new Map<string, { count: number; sum: number }>();
    for (const g of groupPago as any[]) {
      mapPago.set(g.buyerId, { count: g._count._all ?? 0, sum: g._sum.total ?? 0 });
    }

    const mapped = users.map((u) => {
      const all = mapAll.get(u.id) ?? { count: 0, sum: 0 };
      const pago = mapPago.get(u.id) ?? { count: 0, sum: 0 };
      // totalPedidos = todos os pedidos; totalGasto = soma apenas pago/concluido (receita real)
      // mantemos também totalGastoBruto (soma todos) para debug
      return toMemberResponse(u, {
        totalOrders: all.count,
        totalSpentGross: all.sum,
        totalSpentPaid: pago.sum,
      });
    });

    return buildPaginatedResponse(mapped, total, dto);
  }

  async findPedidosByMembro(membroId: string, dto: PaginationDto) {
    const membro = await this.prisma.user.findUnique({
      where: { id: membroId },
      select: { id: true, role: true },
    });
    if (!membro || membro.role !== Role.BUYER) {
      // também permite admin ver se for buyer? Se não for buyer, 404
      // mas se for admin id, retorna 404 com mensagem
      const exists = await this.prisma.user.findUnique({ where: { id: membroId } });
      if (!exists) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Member not found' },
        });
      }
      // se for admin, não tem pedidos – mas ainda permite ver vazio? Exigir buyer
      if (exists.role !== Role.BUYER) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Member not found (not a buyer)' },
        });
      }
    }

    const where = { buyerId: membroId };

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
      buyerId: order.buyerId,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items,
      delivery: order.delivery,
      payment: order.payment,
    }));

    return buildPaginatedResponse(mapped, total, dto);
  }
}
