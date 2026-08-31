import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';
import { buildPaginatedResponse } from '../../../common/dto/pagination.dto';

function calcVariation(
  current: number,
  previous: number,
): { percentage: number | null; grew: boolean | null; difference: number } {
  const difference = current - previous;
  if (previous === 0) {
    if (current === 0) return { percentage: 0, grew: null, difference: 0 };
    return { percentage: 100, grew: true, difference };
  }
  const percentage = Number(((difference / previous) * 100).toFixed(1));
  return {
    percentage,
    grew: difference > 0 ? true : difference < 0 ? false : null,
    difference,
  };
}

function metric(currentValue: number, previousValue: number, totalValue?: number) {
  const v = calcVariation(currentValue, previousValue);
  return {
    value: currentValue,
    previousValue,
    totalValue,
    difference: v.difference,
    percentage: v.percentage,
    grew: v.grew,
  };
}

@Injectable()
export class AdminEstatisticasService {
  constructor(private readonly prisma: PrismaService) {}

  async getEstatisticas(dto: QueryEstatisticasDto) {
    const dias = dto.diasNormalized;
    const now = new Date();

    let inicioAtual: Date;
    let fimAtual: Date;
    let inicioAnterior: Date;
    let fimAnterior: Date;

    const inicioStr = dto.inicioNormalized;
    const fimStr = dto.fimNormalized;

    if (inicioStr && fimStr) {
      inicioAtual = new Date(inicioStr);
      fimAtual = new Date(fimStr);
      fimAtual.setHours(23, 59, 59, 999);
      const durMs = fimAtual.getTime() - inicioAtual.getTime();
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - durMs);
    } else if (inicioStr && !fimStr) {
      inicioAtual = new Date(inicioStr);
      fimAtual = new Date(inicioAtual.getTime() + dias * 24 * 60 * 60 * 1000);
      fimAtual.setHours(23, 59, 59, 999);
      const durMs = fimAtual.getTime() - inicioAtual.getTime();
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - durMs);
    } else {
      fimAtual = now;
      inicioAtual = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - dias * 24 * 60 * 60 * 1000);
    }

    const revenueWhere = { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } };

    const [
      receitaTotalAgg,
      receitaAtualAgg,
      receitaAnteriorAgg,
      totalProdutos,
      produtosAtual,
      produtosAnterior,
      totalMembros,
      membrosAtual,
      membrosAnterior,
      totalPedidos,
      pedidosAtual,
      pedidosAnterior,
    ] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { total: true }, where: revenueWhere }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...revenueWhere, createdAt: { gte: inicioAtual, lte: fimAtual } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...revenueWhere, createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { createdAt: { gte: inicioAtual, lte: fimAtual } } }),
      this.prisma.product.count({
        where: { createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.user.count({ where: { role: Role.BUYER } }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: inicioAtual, lte: fimAtual } },
      }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: inicioAtual, lte: fimAtual } } }),
      this.prisma.order.count({ where: { createdAt: { gte: inicioAnterior, lte: fimAnterior } } }),
    ]);

    const totalRevenue = receitaTotalAgg._sum.total ?? 0;
    const currentRevenue = receitaAtualAgg._sum.total ?? 0;
    const previousRevenue = receitaAnteriorAgg._sum.total ?? 0;

    const wherePedidosRecentes: any = {};
    const [totalRecentes, pedidosRecentes] = await Promise.all([
      this.prisma.order.count({ where: wherePedidosRecentes }),
      this.prisma.order.findMany({
        where: wherePedidosRecentes,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          items: true,
          delivery: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const paginated = buildPaginatedResponse(pedidosRecentes, totalRecentes, dto);

    return {
      totalRevenue,
      revenue: metric(currentRevenue, previousRevenue, totalRevenue),
      totalProducts: totalProdutos,
      products: metric(produtosAtual, produtosAnterior, totalProdutos),
      totalMembers: totalMembros,
      members: metric(membrosAtual, membrosAnterior, totalMembros),
      totalOrders: totalPedidos,
      orders: metric(pedidosAtual, pedidosAnterior, totalPedidos),
      period: {
        days: dias,
        start: inicioAtual,
        end: fimAtual,
        previousStart: inicioAnterior,
        previousEnd: fimAnterior,
      },
      variation: {
        revenue: calcVariation(currentRevenue, previousRevenue),
        products: calcVariation(produtosAtual, produtosAnterior),
        members: calcVariation(membrosAtual, membrosAnterior),
        orders: calcVariation(pedidosAtual, pedidosAnterior),
      },
      recentOrders: paginated,
    };
  }
}
