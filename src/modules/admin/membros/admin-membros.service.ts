import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterMembrosDto } from './dto/filter-membros.dto';

function toMemberResponse(
  user: any,
  stats: { totalPedidos: number; totalGasto: number; totalGastoPago: number },
) {
  return {
    id: user.id,
    nome: user.name,
    name: user.name,
    email: user.email,
    role: user.role,
    criadoEm: user.createdAt,
    createdAt: user.createdAt,
    ativo: user.isActive,
    isActive: user.isActive,
    // agregados via join real por comprador_id
    totalPedidos: stats.totalPedidos,
    total_pedidos: stats.totalPedidos,
    nPedidos: stats.totalPedidos,
    n_pedidos: stats.totalPedidos,
    pedidosCount: stats.totalPedidos,
    totalGasto: stats.totalGastoPago,
    total_gasto: stats.totalGastoPago,
    totalSpent: stats.totalGastoPago,
    total_gasto_bruto: stats.totalGasto,
    totalGastoBruto: stats.totalGasto,
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
        totalPedidos: all.count,
        totalGasto: all.sum,
        totalGastoPago: pago.sum,
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
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Membro não encontrado' },
        });
      }
      // se for admin, não tem pedidos – mas ainda permite ver vazio? Exigir buyer
      if (exists.role !== Role.BUYER) {
        throw new NotFoundException({
          erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Membro não encontrado (não é comprador)' },
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
      pedido_id: order.id,
      order_id: order.id,
      comprador_id: order.buyerId,
      buyerId: order.buyerId,
      buyer_id: order.buyerId,
      subtotal: order.subtotal,
      taxa_entrega: order.deliveryFee,
      deliveryFee: order.deliveryFee,
      total: order.total,
      estado: order.status,
      status: order.status,
      criado_em: order.createdAt,
      createdAt: order.createdAt,
      itens: order.items,
      items: order.items,
      entrega: order.delivery,
      delivery: order.delivery,
      pagamento: order.payment,
      payment: order.payment,
    }));

    return buildPaginatedResponse(mapped, total, dto);
  }
}
