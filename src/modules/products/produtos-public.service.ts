import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, Produto } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FiltrarProdutosPublicDto, OrdenarProdutos } from './dto/filtrar-produtos-public.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/dto/pagination.dto';

function discountedPrice(p: Produto): number {
  return Math.round(p.price - (p.price * p.desconto) / 100);
}

function buildCacheKeyProdutos(query: FiltrarProdutosPublicDto): string {
  const parts: string[] = [];
  if (query.q) parts.push(`q=${query.q}`);
  if (query.categoria?.length) parts.push(`categoria=${[...query.categoria].sort().join(',')}`);
  if (query.tamanho?.length) parts.push(`tamanho=${[...query.tamanho].sort().join(',')}`);
  if (query.estado?.length) parts.push(`estado=${[...query.estado].sort().join(',')}`);
  if (query.preco_min !== undefined) parts.push(`preco_min=${query.preco_min}`);
  if (query.preco_max !== undefined) parts.push(`preco_max=${query.preco_max}`);
  if (query.ordenar) parts.push(`ordenar=${query.ordenar}`);
  parts.push(`page=${query.page ?? 1}`);
  parts.push(`limit=${query.limit ?? 20}`);
  return `cache:produtos:${parts.join('|') || 'all'}`;
}

@Injectable()
export class ProdutosPublicService {
  private readonly logger = new Logger(ProdutosPublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(query: FiltrarProdutosPublicDto): Promise<PaginatedResponse<Produto>> {
    const cacheKey = buildCacheKeyProdutos(query);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as PaginatedResponse<Produto>;
      } catch {
        // ignore parse error, recompute
      }
    }

    const where: Prisma.ProdutoWhereInput = {};

    if (query.q) {
      where.OR = [
        { nomeProduto: { contains: query.q, mode: 'insensitive' as const } },
        { descricao: { contains: query.q, mode: 'insensitive' as const } },
      ];
    }

    if (query.categoria?.length) {
      where.categoria = { in: query.categoria };
    }

    if (query.tamanho?.length) {
      where.tamanho = { in: query.tamanho };
    }

    if (query.estado?.length) {
      where.estado = { in: query.estado };
    }

    // Buscar todos que batem nos filtros não-preço (paginação será feita após filtro de preço)
    const produtos = await this.prisma.produto.findMany({
      where,
    });

    // Filtro por preco com desconto
    let filtrados = produtos;
    if (query.preco_min !== undefined || query.preco_max !== undefined) {
      filtrados = filtrados.filter((p) => {
        const d = discountedPrice(p);
        if (query.preco_min !== undefined && d < query.preco_min) return false;
        if (query.preco_max !== undefined && d > query.preco_max) return false;
        return true;
      });
    }

    // Ordenação
    const ordenar = query.ordenar ?? OrdenarProdutos.recentes;
    filtrados.sort((a, b) => {
      switch (ordenar) {
        case OrdenarProdutos.preco_asc:
          return discountedPrice(a) - discountedPrice(b);
        case OrdenarProdutos.preco_desc:
          return discountedPrice(b) - discountedPrice(a);
        case OrdenarProdutos.nome_asc:
          return a.nomeProduto.localeCompare(b.nomeProduto);
        case OrdenarProdutos.nome_desc:
          return b.nomeProduto.localeCompare(a.nomeProduto);
        case OrdenarProdutos.antigos:
          return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
        case OrdenarProdutos.recentes:
        default:
          return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
      }
    });

    const total = filtrados.length;
    const paginados = filtrados.slice(query.skip, query.skip + query.take);
    const result = buildPaginatedResponse(paginados, total, query);

    await this.redis.set(cacheKey, JSON.stringify(result), 60);
    this.logger.debug(`Cache SET ${cacheKey} ttl 60s (${result.dados.length}/${total})`);

    return result;
  }

  async findOne(id: string): Promise<Produto> {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }
    return produto;
  }

  async clearCache(): Promise<void> {
    await this.redis.delByPattern('cache:produtos:*');
    await this.redis.del('cache:categorias');
  }
}
