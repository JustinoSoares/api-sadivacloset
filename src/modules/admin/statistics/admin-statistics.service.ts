import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryStatisticsDto } from './dto/query-statistics.dto';
import { buildPaginatedResponse } from '../../../common/dto/pagination.dto';

function calcVariation(
  current: number,
  previous: number,
): {
  percentage: number | null;
  grew: boolean | null;
  difference: number;
} {
  const difference = current - previous;
  if (previous === 0) {
    if (current === 0)
      return {
        percentage: 0,
        grew: null,
        difference: 0,
      };
    return {
      percentage: 100,
      grew: true,
      difference,
    };
  }
  const percentage = Number(((difference / previous) * 100).toFixed(1));
  const grew = difference > 0 ? true : difference < 0 ? false : null;
  return { percentage, grew, difference };
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
export class AdminStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics(dto: QueryStatisticsDto) {
    const days = (dto as any).daysNormalized ?? (dto as any).diasNormalized ?? 30;
    const now = new Date();

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    const startStr = (dto as any).startNormalized ?? (dto as any).inicioNormalized;
    const endStr = (dto as any).endNormalized ?? (dto as any).fimNormalized;

    if (startStr && endStr) {
      currentStart = new Date(startStr);
      currentEnd = new Date(endStr);
      currentEnd.setHours(23, 59, 59, 999);
      const durMs = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - durMs);
    } else if (startStr && !endStr) {
      currentStart = new Date(startStr);
      currentEnd = new Date(currentStart.getTime() + days * 24 * 60 * 60 * 1000);
      currentEnd.setHours(23, 59, 59, 999);
      const durMs = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - durMs);
    } else {
      currentEnd = now;
      currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const revenueWhere = { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } };

    const [
      totalRevenueAgg,
      currentRevenueAgg,
      previousRevenueAgg,
      totalProducts,
      currentProducts,
      previousProducts,
      totalMembers,
      currentMembers,
      previousMembers,
      totalOrders,
      currentOrders,
      previousOrders,
    ] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { total: true }, where: revenueWhere }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...revenueWhere, createdAt: { gte: currentStart, lte: currentEnd } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...revenueWhere, createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { createdAt: { gte: currentStart, lte: currentEnd } } }),
      this.prisma.product.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
      this.prisma.user.count({ where: { role: Role.BUYER } }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: currentStart, lte: currentEnd } },
      }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: previousStart, lte: previousEnd } },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: currentStart, lte: currentEnd } } }),
      this.prisma.order.count({ where: { createdAt: { gte: previousStart, lte: previousEnd } } }),
    ]);

    const totalRevenue = totalRevenueAgg._sum.total ?? 0;
    const currentRevenue = currentRevenueAgg._sum.total ?? 0;
    const previousRevenue = previousRevenueAgg._sum.total ?? 0;

    const whereRecent: any = {};
    const [totalRecent, recentOrders] = await Promise.all([
      this.prisma.order.count({ where: whereRecent }),
      this.prisma.order.findMany({
        where: whereRecent,
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

    const paginated = buildPaginatedResponse(recentOrders, totalRecent, dto);

    return {
      totalRevenue,
      revenue: metric(currentRevenue, previousRevenue, totalRevenue),
      totalProducts,
      products: metric(currentProducts, previousProducts, totalProducts),
      totalMembers,
      members: metric(currentMembers, previousMembers, totalMembers),
      totalOrders,
      orders: metric(currentOrders, previousOrders, totalOrders),
      period: {
        days,
        start: currentStart,
        end: currentEnd,
        previousStart,
        previousEnd,
      },
      variation: {
        revenue: calcVariation(currentRevenue, previousRevenue),
        products: calcVariation(currentProducts, previousProducts),
        members: calcVariation(currentMembers, previousMembers),
        orders: calcVariation(currentOrders, previousOrders),
      },
      recentOrders: paginated,
    };
  }

  // legacy alias
  async getEstatisticas(dto: QueryStatisticsDto) {
    return this.getStatistics(dto);
  }
}

// legacy export
export const AdminEstatisticasService = AdminStatisticsService;
