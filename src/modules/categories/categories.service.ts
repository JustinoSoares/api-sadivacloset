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
  category: Category;
  total: number;
}

const CACHE_KEY = 'cache:categories';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(): Promise<{ data: CategoryWithCount[] }> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.data && Array.isArray(parsed.data)) {
          return { data: parsed.data };
        }
        if (Array.isArray(parsed)) {
          return { data: parsed as CategoryWithCount[] };
        }
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

    const result = { data };
    await this.redis.set(CACHE_KEY, JSON.stringify(result), 60);
    this.logger.debug(`Cache SET ${CACHE_KEY} ttl 60s`);

    return result;
  }

  async clearCache(): Promise<void> {
    await this.redis.del(CACHE_KEY);
    await this.redis.del('cache:categorias');
  }
}

// legacy alias
export const CategoriasService = CategoriesService;
