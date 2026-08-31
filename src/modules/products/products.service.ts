import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FilterProductsDto, SortOrder } from './dto/filter-products.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/dto/pagination.dto';

function discountedPrice(p: Product): number {
  return Math.round(p.price - (p.price * p.discount) / 100);
}

function buildCacheKey(query: FilterProductsDto): string {
  const parts: string[] = [];
  if (query.q) parts.push(`q=${query.q}`);
  const cat = (query as any).normalizedCategory ?? query.category ?? (query as any).categoria;
  const size = (query as any).normalizedSize ?? query.size ?? (query as any).tamanho;
  const cond = (query as any).normalizedCondition ?? query.condition ?? (query as any).estado;
  const pMin = (query as any).normalizedPriceMin ?? query.price_min ?? (query as any).preco_min;
  const pMax = (query as any).normalizedPriceMax ?? query.price_max ?? (query as any).preco_max;
  const sort = (query as any).normalizedSort ?? query.sort ?? (query as any).ordenar;
  if (cat?.length) parts.push(`category=${[...cat].sort().join(',')}`);
  if (size?.length) parts.push(`size=${[...size].sort().join(',')}`);
  if (cond?.length) parts.push(`condition=${[...cond].sort().join(',')}`);
  if (pMin !== undefined) parts.push(`price_min=${pMin}`);
  if (pMax !== undefined) parts.push(`price_max=${pMax}`);
  if (sort) parts.push(`sort=${sort}`);
  parts.push(`page=${query.page ?? 1}`);
  parts.push(`limit=${query.limit ?? 20}`);
  return `cache:products:${parts.join('|') || 'all'}`;
}

@Injectable()
// keep legacy name alias
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(query: FilterProductsDto): Promise<PaginatedResponse<Product>> {
    const cacheKey = buildCacheKey(query);
    // also try legacy key for backward compatibility
    const legacyKey = `cache:produtos:${cacheKey.split(':').slice(1).join(':')}`;
    const cached = (await this.redis.get(cacheKey)) ?? (await this.redis.get(legacyKey));
    if (cached) {
      try {
        return JSON.parse(cached) as PaginatedResponse<Product>;
      } catch {
        // ignore
      }
    }

    const category =
      (query as any).normalizedCategory ?? query.category ?? (query as any).categoria;
    const size = (query as any).normalizedSize ?? query.size ?? (query as any).tamanho;
    const condition =
      (query as any).normalizedCondition ?? query.condition ?? (query as any).estado;
    const priceMin =
      (query as any).normalizedPriceMin ?? query.price_min ?? (query as any).preco_min;
    const priceMax =
      (query as any).normalizedPriceMax ?? query.price_max ?? (query as any).preco_max;
    const sort =
      (query as any).normalizedSort ?? query.sort ?? (query as any).ordenar ?? SortOrder.recent;

    const where: Prisma.ProductWhereInput = {};

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' as const } },
        { description: { contains: query.q, mode: 'insensitive' as const } },
      ];
    }

    if (category?.length) {
      where.category = { in: category };
    }

    if (size?.length) {
      where.size = { in: size };
    }

    if (condition?.length) {
      where.condition = { in: condition };
    }

    const products = await this.prisma.product.findMany({ where });

    let filtered = products;
    if (priceMin !== undefined || priceMax !== undefined) {
      filtered = filtered.filter((p) => {
        const d = discountedPrice(p);
        if (priceMin !== undefined && d < priceMin) return false;
        if (priceMax !== undefined && d > priceMax) return false;
        return true;
      });
    }

    // map legacy sort values to new
    const sortMap: Record<string, SortOrder> = {
      recentes: SortOrder.recent,
      antigos: SortOrder.oldest,
      preco_asc: SortOrder.price_asc,
      preco_desc: SortOrder.price_desc,
      nome_asc: SortOrder.name_asc,
      nome_desc: SortOrder.name_desc,
    };
    const normalizedSort = (sortMap[sort as string] ?? sort) as SortOrder;

    filtered.sort((a, b) => {
      switch (normalizedSort) {
        case SortOrder.price_asc:
          return discountedPrice(a) - discountedPrice(b);
        case SortOrder.price_desc:
          return discountedPrice(b) - discountedPrice(a);
        case SortOrder.name_asc:
          return a.name.localeCompare(b.name);
        case SortOrder.name_desc:
          return b.name.localeCompare(a.name);
        case SortOrder.oldest:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case SortOrder.recent:
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    const total = filtered.length;
    const paginated = filtered.slice(query.skip, query.skip + query.take);
    const result = buildPaginatedResponse(paginated, total, query);

    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    // also set legacy key for backward compat
    await this.redis.set(legacyKey, JSON.stringify(result), 60);
    this.logger.debug(`Cache SET ${cacheKey} ttl 60s (${result.data.length}/${total})`);

    return result;
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }
    return product;
  }

  async clearCache(): Promise<void> {
    await this.redis.delByPattern('cache:products:*');
    await this.redis.delByPattern('cache:produtos:*');
    await this.redis.del('cache:categories');
    await this.redis.del('cache:categorias');
  }
}

// legacy alias
export const ProdutosPublicService = ProductsService;
