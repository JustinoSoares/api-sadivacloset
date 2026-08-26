import { Injectable, Logger } from '@nestjs/common';
import { DeliveryZone } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface DeliveryZoneResponse {
  id: string;
  neighborhood: string;
  bairro: string;
  price: number;
  preco: number;
}

export interface ZonaEntregaResponse {
  id: string;
  bairro: string;
  preco: number;
  neighborhood: string;
  price: number;
}

export interface DeliveryZonesListResponse {
  data: DeliveryZoneResponse[];
  dados: ZonaEntregaResponse[];
}

const CACHE_KEY_EN = 'cache:delivery-zones';
const CACHE_KEY_PT = 'cache:zonas-entrega';

function toBilingual(zone: DeliveryZone): DeliveryZoneResponse & ZonaEntregaResponse {
  return {
    id: zone.id,
    neighborhood: zone.neighborhood,
    bairro: zone.neighborhood,
    price: zone.price,
    preco: zone.price,
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
    const cachedEn = await this.redis.get(CACHE_KEY_EN);
    const cachedPt = await this.redis.get(CACHE_KEY_PT);
    const cached = cachedEn ?? cachedPt;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DeliveryZonesListResponse;
        // normalize legacy shapes — ensure both data/dados exist
        if (parsed.data && !parsed.dados) {
          return { data: parsed.data as any, dados: parsed.data as any };
        }
        if (parsed.dados && !parsed.data) {
          return { data: parsed.dados as any, dados: parsed.dados as any };
        }
        if (parsed.data && parsed.dados) {
          return parsed;
        }
        // if cached is plain array (older shape), wrap it
        if (Array.isArray(parsed as any)) {
          const arr = parsed as unknown as DeliveryZoneResponse[];
          return { data: arr, dados: arr as unknown as ZonaEntregaResponse[] };
        }
      } catch {
        // ignore parse error
      }
    }

    const zones = await this.prisma.deliveryZone.findMany({
      orderBy: { neighborhood: 'asc' },
    });

    const bilingual = zones.map(toBilingual);
    const result: DeliveryZonesListResponse = {
      data: bilingual,
      dados: bilingual,
    };

    const serialized = JSON.stringify(result);
    await this.redis.set(CACHE_KEY_EN, serialized, 60);
    await this.redis.set(CACHE_KEY_PT, serialized, 60);
    this.logger.debug(`Cache SET ${CACHE_KEY_EN} ttl 60s (${bilingual.length} zones)`);

    return result;
  }

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY_EN);
    await this.redis.del(CACHE_KEY_PT);
  }
}

// legacy Portuguese alias
export const ZonasEntregaService = DeliveryZonesService;
