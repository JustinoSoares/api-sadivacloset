import { Injectable, Logger } from '@nestjs/common';
import { Categoria } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface CategoriaComContagem {
  categoria: Categoria;
  total: number;
}

const CACHE_KEY = 'cache:categorias';

@Injectable()
export class CategoriasService {
  private readonly logger = new Logger(CategoriasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(): Promise<{ dados: CategoriaComContagem[] }> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as { dados: CategoriaComContagem[] };
      } catch {
        // ignore
      }
    }

    const counts = await this.prisma.produto.groupBy({
      by: ['categoria'],
      _count: { categoria: true },
      // Considerar apenas produtos com volume > 0 como ativos? Se quiser todos, remover where
      // where: { volume: { gt: 0 } },
    });

    const map = new Map<string, number>();
    for (const c of counts) {
      map.set(c.categoria, c._count.categoria);
    }

    const dados: CategoriaComContagem[] = (Object.values(Categoria) as Categoria[]).map((cat) => ({
      categoria: cat,
      total: map.get(cat) ?? 0,
    }));

    const result = { dados };
    await this.redis.set(CACHE_KEY, JSON.stringify(result), 60);
    this.logger.debug(`Cache SET ${CACHE_KEY} ttl 60s`);

    return result;
  }

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY);
  }
}
