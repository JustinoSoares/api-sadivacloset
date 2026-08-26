import { Injectable, Logger } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface CategoryWithCount {
  category: Category;
  total: number;
}

// legacy alias
export interface CategoriaComContagem {
  categoria: Category;
  total: number;
}

const CACHE_KEY_EN = 'cache:categories';
const CACHE_KEY_PT = 'cache:categorias';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(): Promise<{ data: CategoryWithCount[]; dados: CategoriaComContagem[] }> {
    const cachedEn = await this.redis.get(CACHE_KEY_EN);
    const cachedPt = await this.redis.get(CACHE_KEY_PT);
    const cached = cachedEn ?? cachedPt;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // normalize to both en/pt
        if (parsed.data && !parsed.dados) {
          return { data: parsed.data, dados: parsed.data.map((c: any) => ({ categoria: c.category, total: c.total })) };
        }
        if (parsed.dados && !parsed.data) {
          return { data: parsed.dados.map((c: any) => ({ category: c.categoria, total: c.total })), dados: parsed.dados };
        }
        return parsed;
      } catch {
        // ignore
      }
    }

    const counts = await this.prisma.product.groupBy({
      by: ['category'],
      _count: { category: true },
    });

    const map = new Map<string, number>();
    for (const c of counts) {
      map.set(c.category, c._count.category);
    }

    const data: CategoryWithCount[] = (Object.values(Category) as Category[]).map((cat) => ({
      category: cat,
      total: map.get(cat) ?? 0,
    }));

    const dados: CategoriaComContagem[] = data.map((d) => ({ categoria: d.category, total: d.total }));

    const result: any = { data, dados };
    await this.redis.set(CACHE_KEY_EN, JSON.stringify(result), 60);
    await this.redis.set(CACHE_KEY_PT, JSON.stringify(result), 60);
    this.logger.debug(`Cache SET ${CACHE_KEY_EN} ttl 60s`);

    return result;
  }

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY_EN);
    await this.redis.del(CACHE_KEY_PT);
  }
}

// legacy alias
export const CategoriasService = CategoriesService;
