import { Injectable, Logger } from '@nestjs/common';
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

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY);
    await this.redis.del('cache:zonas-entrega');
  }
}

// legacy Portuguese alias
export const ZonasEntregaService = DeliveryZonesService;
