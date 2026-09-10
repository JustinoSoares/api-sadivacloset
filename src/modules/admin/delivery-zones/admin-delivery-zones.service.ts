import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryZone } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/create-delivery-zone.dto';

@Injectable()
export class AdminDeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private async invalidateCache(): Promise<void> {
    await this.redis.del('cache:delivery-zones');
    await this.redis.del('cache:zonas-entrega');
  }

  async findAll(): Promise<{ data: DeliveryZone[] }> {
    const zones = await this.prisma.deliveryZone.findMany({ orderBy: { neighborhood: 'asc' } });
    return { data: zones };
  }

  async findOne(id: string): Promise<DeliveryZone> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) {
      throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Delivery zone not found' } });
    }
    return zone;
  }

  async create(dto: CreateDeliveryZoneDto, adminId?: string): Promise<DeliveryZone> {
    const neighborhood = (dto as any).neighborhood ?? (dto as any).bairro;
    const price = (dto as any).price ?? (dto as any).preco ?? (dto as any).valor;
    const name = typeof neighborhood === 'string' ? neighborhood.trim() : '';
    if (!name) throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'neighborhood is required' } });

    const exists = await this.prisma.deliveryZone.findUnique({ where: { neighborhood: name } });
    if (exists) throw new BadRequestException({ error: { code: 'CONFLICT', message: `Delivery zone '${name}' already exists` } });

    const zone = await this.prisma.deliveryZone.create({ data: { neighborhood: name, price } });
    await this.invalidateCache();
    if (adminId) await this.audit.register(adminId, 'create_delivery_zone', 'delivery_zone', zone.id, { neighborhood: name, price }).catch(() => {});
    return zone;
  }

  async update(id: string, dto: UpdateDeliveryZoneDto, adminId?: string): Promise<DeliveryZone> {
    const exists = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Delivery zone not found' } });

    const neighborhood = (dto as any).neighborhood ?? (dto as any).bairro;
    const price = (dto as any).price ?? (dto as any).preco ?? (dto as any).valor;

    if (neighborhood !== undefined) {
      const name = String(neighborhood).trim();
      if (!name) throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'neighborhood cannot be empty' } });
      const dup = await this.prisma.deliveryZone.findUnique({ where: { neighborhood: name } });
      if (dup && dup.id !== id) throw new BadRequestException({ error: { code: 'CONFLICT', message: `Delivery zone '${name}' already exists` } });
    }

    const updated = await this.prisma.deliveryZone.update({
      where: { id },
      data: {
        ...(neighborhood !== undefined ? { neighborhood: String(neighborhood).trim() } : {}),
        ...(price !== undefined ? { price } : {}),
      },
    });
    await this.invalidateCache();
    if (adminId) await this.audit.register(adminId, 'update_delivery_zone', 'delivery_zone', id, { before: exists, after: updated }).catch(() => {});
    return updated;
  }

  async remove(id: string, adminId?: string): Promise<{ message: string }> {
    const exists = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException({ error: { code: 'NOT_FOUND', message: 'Delivery zone not found' } });
    await this.prisma.deliveryZone.delete({ where: { id } });
    await this.invalidateCache();
    if (adminId) await this.audit.register(adminId, 'remove_delivery_zone', 'delivery_zone', id, { neighborhood: exists.neighborhood }).catch(() => {});
    return { message: 'Delivery zone removed' };
  }
}
