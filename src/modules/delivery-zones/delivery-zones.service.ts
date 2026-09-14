import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeliveryZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface DeliveryZoneResponse {
  id: string;
  neighborhood: string;
  price: number;
}

export interface ZonaEntregaResponse {
  id: string;
  neighborhood: string;
  price: number;
}

export interface DeliveryZonesListResponse {
  data: DeliveryZoneResponse[];
}

export interface DeliveryZoneQuoteResponse {
  deliveryFee: number;
  deliveryZone: DeliveryZoneResponse | null;
  source: 'zone_id' | 'neighborhood' | 'address' | 'default';
}

const CACHE_KEY = 'cache:delivery-zones';

function toResponse(zone: DeliveryZone): DeliveryZoneResponse {
  return {
    id: zone.id,
    neighborhood: zone.neighborhood,
    price: zone.price,
  };
}

@Injectable()
export class DeliveryZonesService {
  private readonly logger = new Logger(DeliveryZonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(): Promise<DeliveryZonesListResponse> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as any;
        if (parsed.data && Array.isArray(parsed.data)) {
          return { data: parsed.data };
        }
        if (Array.isArray(parsed)) {
          return { data: parsed as DeliveryZoneResponse[] };
        }
      } catch {
        // ignore parse error
      }
    }

    const zones = await this.prisma.deliveryZone.findMany({
      orderBy: { neighborhood: 'asc' },
    });

    const data = zones.map(toResponse);
    const result: DeliveryZonesListResponse = {
      data,
    };

    const serialized = JSON.stringify(result);
    await this.redis.set(CACHE_KEY, serialized, 60);
    this.logger.debug(`Cache SET ${CACHE_KEY} ttl 60s (${data.length} zones)`);

    return result;
  }

  async findOne(id: string): Promise<DeliveryZoneResponse> {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Zona de entrega não encontrada.' },
      });
    }
    return toResponse(zone);
  }

  async findByNeighborhood(neighborhood: string): Promise<DeliveryZoneResponse> {
    const name = neighborhood.trim();
    const zone = await this.prisma.deliveryZone.findUnique({ where: { neighborhood: name } });
    if (!zone) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: `Zona '${name}' não encontrada.` },
      });
    }
    return toResponse(zone);
  }

  /**
   * Calcula taxa de entrega unificada – mesma lógica usada no CheckoutService
   * Prioriza: zoneId > neighborhood > addressId > defaultDeliveryFee
   */
  async quote(params: {
    zoneId?: string;
    neighborhood?: string;
    addressId?: string;
    buyerId?: string;
  }): Promise<DeliveryZoneQuoteResponse> {
    // 1) zoneId explícito
    if (params.zoneId) {
      const zone = await this.prisma.deliveryZone.findUnique({ where: { id: params.zoneId } });
      if (!zone) {
        throw new NotFoundException({
          error: { code: 'NOT_FOUND', message: 'Zona de entrega não encontrada.' },
        });
      }
      return { deliveryFee: zone.price, deliveryZone: toResponse(zone), source: 'zone_id' };
    }

    // 2) neighborhood explícito
    if (params.neighborhood) {
      const name = params.neighborhood.trim();
      const zone = await this.prisma.deliveryZone.findUnique({ where: { neighborhood: name } });
      if (zone) {
        return { deliveryFee: zone.price, deliveryZone: toResponse(zone), source: 'neighborhood' };
      }
      // se não encontrou bairro, cai para default
    }

    // 3) addressId – busca bairro do endereço
    if (params.addressId) {
      const address = await this.prisma.address.findUnique({ where: { id: params.addressId } });
      if (address) {
        const zone = await this.prisma.deliveryZone.findUnique({
          where: { neighborhood: address.neighborhood },
        });
        if (zone) {
          return { deliveryFee: zone.price, deliveryZone: toResponse(zone), source: 'address' };
        }
      }
    }

    // 4) buyerId default address
    if (params.buyerId) {
      const defaultAddress = await this.prisma.address.findFirst({
        where: { buyerId: params.buyerId, isDefault: true },
      });
      if (defaultAddress) {
        const zone = await this.prisma.deliveryZone.findUnique({
          where: { neighborhood: defaultAddress.neighborhood },
        });
        if (zone) {
          return { deliveryFee: zone.price, deliveryZone: toResponse(zone), source: 'address' };
        }
      }
    }

    // 5) fallback defaultDeliveryFee
    const prefs = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    const fee = prefs?.defaultDeliveryFee ?? 0;
    return { deliveryFee: fee, deliveryZone: null, source: 'default' };
  }

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY);
    await this.redis.del('cache:zonas-entrega');
  }
}

// legacy Portuguese alias
export const ZonasEntregaService = DeliveryZonesService;
