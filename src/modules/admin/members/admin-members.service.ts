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

    // Enriquecer com endereço padrão + zona
    const defaultAddresses = await this.prisma.address.findMany({ where: { buyerId: { in: ids }, isDefault: true } });
    const addrMap = new Map(defaultAddresses.map((a: any) => [a.buyerId, a]));
    const neighborhoods = [...new Set(defaultAddresses.map((a: any) => a.neighborhood))];
    const zones = neighborhoods.length ? await this.prisma.deliveryZone.findMany({ where: { neighborhood: { in: neighborhoods } } }) : [];
    const zoneMap = new Map(zones.map((z: any) => [z.neighborhood, z]));
    const prefs = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });

    const mapped = users.map((u) => {
      const all = mapAll.get(u.id) ?? { count: 0, sum: 0 };
      const paid = mapPaid.get(u.id) ?? { count: 0, sum: 0 };
      const base = toMemberResponse(u, {
        totalOrders: all.count,
        totalSpentGross: all.sum,
        totalSpentPaid: paid.sum,
      });
      const addr = addrMap.get(u.id);
      let defaultAddress: any = null;
      let defaultDeliveryZone: any = null;
      if (addr) {
        const zone = zoneMap.get(addr.neighborhood);
        if (zone) defaultDeliveryZone = { id: zone.id, neighborhood: zone.neighborhood, price: zone.price };
        else if (prefs) defaultDeliveryZone = { id: 'default', neighborhood: addr.neighborhood, price: prefs.defaultDeliveryFee };
        defaultAddress = { ...addr, deliveryZone: defaultDeliveryZone };
      }
      return { ...base, defaultAddress, defaultDeliveryZone };
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
          error: { code: 'NOT_FOUND', message: 'Member not found' },
        });
      }
      if (exists.role !== Role.BUYER) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Member not found (not a buyer)' },
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

    const enriched = await Promise.all(orders.map(async (order: any) => {
      let deliveryEnriched: any = order.delivery;
      if (order.delivery?.addressId) {
        const addr = await this.prisma.address.findUnique({ where: { id: order.delivery.addressId } });
        if (addr) {
          const zone = await this.prisma.deliveryZone.findUnique({ where: { neighborhood: addr.neighborhood } });
          const deliveryZone = zone ? { id: zone.id, neighborhood: zone.neighborhood, price: zone.price } : null;
          deliveryEnriched = { ...order.delivery, address: { ...addr, deliveryZone }, deliveryZone };
        }
      }
      const itemsEnriched = await Promise.all((order.items ?? []).map(async (it: any) => {
        const prod = await this.prisma.product.findUnique({ where: { id: it.productId } });
        return { ...it, product: prod ? { id: prod.id, name: prod.name, image: prod.image, category: prod.category, size: prod.size, condition: prod.condition, price: prod.price, discount: prod.discount } : null };
      }));
      return { id: order.id, buyerId: order.buyerId, subtotal: order.subtotal, deliveryFee: order.deliveryFee, total: order.total, status: order.status, createdAt: order.createdAt, items: itemsEnriched, delivery: deliveryEnriched, payment: order.payment };
    }));

    return buildPaginatedResponse(enriched, total, dto);
  }

  // legacy alias
  async findPedidosByMembro(membroId: string, dto: PaginationDto) {
    return this.findOrdersByMember(membroId, dto);
  }
}

// legacy export
export const AdminMembrosService = AdminMembersService;
