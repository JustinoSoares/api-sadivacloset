import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Address, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressResponse {
  id: string;
  buyerId: string;
  label: string;
  province: string;
  municipality: string;
  neighborhood: string;
  street: string;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  deliveryZone?: { id: string; neighborhood: string; price: number } | null;
}

function toResponse(a: Address, deliveryZone?: { id: string; neighborhood: string; price: number } | null): AddressResponse {
  return {
    id: a.id,
    buyerId: a.buyerId,
    label: a.label,
    province: a.province,
    municipality: a.municipality,
    neighborhood: a.neighborhood,
    street: a.street,
    reference: a.reference ?? null,
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    isDefault: a.isDefault,
    deliveryZone: deliveryZone ?? null,
  };
}

async function enrichWithZone(prisma: any, address: Address): Promise<AddressResponse> {
  const zone = await prisma.deliveryZone.findUnique({ where: { neighborhood: address.neighborhood } });
  if (zone) return toResponse(address, { id: zone.id, neighborhood: zone.neighborhood, price: zone.price });
  const prefs = await prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
  if (prefs) return toResponse(address, { id: 'default', neighborhood: address.neighborhood, price: prefs.defaultDeliveryFee });
  return toResponse(address, null);
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(buyerId: string): Promise<AddressResponse[]> {
    const addresses = await this.prisma.address.findMany({
      where: { buyerId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    const neighborhoods = [...new Set(addresses.map((a) => a.neighborhood))];
    const zones = await this.prisma.deliveryZone.findMany({ where: { neighborhood: { in: neighborhoods } } });
    const zoneMap = new Map(zones.map((z: any) => [z.neighborhood, z]));
    const prefs = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    return addresses.map((a) => {
      const zone = zoneMap.get(a.neighborhood);
      if (zone) return toResponse(a, { id: zone.id, neighborhood: zone.neighborhood, price: zone.price });
      if (prefs) return toResponse(a, { id: 'default', neighborhood: a.neighborhood, price: prefs.defaultDeliveryFee });
      return toResponse(a, null);
    });
  }

  async create(
    buyerId: string,
    data: {
      label: string;
      province: string;
      municipality: string;
      neighborhood: string;
      street: string;
      reference?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<AddressResponse> {
    const count = await this.prisma.address.count({ where: { buyerId } });
    const isDefault = count === 0 ? true : false;

    const created = await this.prisma.address.create({
      data: {
        buyerId,
        label: data.label,
        province: data.province,
        municipality: data.municipality,
        neighborhood: data.neighborhood,
        street: data.street,
        reference: data.reference ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault,
      },
    });
    return enrichWithZone(this.prisma, created);
  }

  async update(
    buyerId: string,
    id: string,
    data: {
      label?: string;
      province?: string;
      municipality?: string;
      neighborhood?: string;
      street?: string;
      reference?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<AddressResponse> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Address not found' },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.province !== undefined ? { province: data.province } : {}),
        ...(data.municipality !== undefined ? { municipality: data.municipality } : {}),
        ...(data.neighborhood !== undefined ? { neighborhood: data.neighborhood } : {}),
        ...(data.street !== undefined ? { street: data.street } : {}),
        ...(data.reference !== undefined ? { reference: data.reference } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      },
    });
    return enrichWithZone(this.prisma, updated);
  }

  async remove(buyerId: string, id: string): Promise<void> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Address not found' },
      });
    }

    const count = await this.prisma.address.count({ where: { buyerId } });

    if (count === 1) {
      const pendingStatuses: OrderStatus[] = [
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.PREPARING,
        OrderStatus.SHIPPING,
      ];

      const linkedPending = await this.prisma.delivery.findFirst({
        where: {
          addressId: id,
          order: {
            buyerId,
            status: { in: pendingStatuses },
          },
        },
      });

      if (linkedPending) {
        throw new BadRequestException({
          error: {
            code: 'ADDRESS_IN_USE',
            message: 'Cannot remove the only address with pending orders associated',
            details: { addressId: id },
          },
        });
      }
    }

    await this.prisma.address.delete({ where: { id } });

    if (existing.isDefault) {
      const remaining = await this.prisma.address.findFirst({
        where: { buyerId },
        orderBy: { id: 'asc' },
      });
      if (remaining) {
        await this.prisma.address.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefault(buyerId: string, id: string): Promise<AddressResponse> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Address not found' },
      });
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { buyerId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return enrichWithZone(this.prisma, updated);
  }
}

export const EnderecosService = AddressesService;
