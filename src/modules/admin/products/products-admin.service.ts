import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../../common/dto/pagination.dto';

@Injectable()
export class ProductsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private async invalidateCatalogCache(): Promise<void> {
    await this.redis.delByPattern('cache:products:*');
    await this.redis.delByPattern('cache:produtos:*');
    await this.redis.del('cache:categories');
    await this.redis.del('cache:categorias');
  }

  async findAll(query: FilterProductsDto): Promise<PaginatedResponse<Product>> {
    const where: Prisma.ProductWhereInput = {};

    if ((query as any).q) {
      const q = (query as any).q;
      where.name = {
        contains: q,
        mode: 'insensitive' as const,
      };
    }

    const category = (query as any).category ?? (query as any).categoria;
    if (category) {
      where.category = category;
    }

    const [total, data] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const result: any = buildPaginatedResponse(data as any, total, query as any);
    result.dados = result.data ?? result.dados;
    return result;
  }

  async create(dto: CreateProductDto & any, adminId?: string): Promise<Product> {
    const image = dto.image ?? dto.imagem;
    const name = dto.name ?? dto.nomeProduto ?? dto.nome;
    const description = dto.description ?? dto.descricao;
    const category = dto.category ?? dto.categoria;
    const size = dto.size ?? dto.tamanho;
    const condition = dto.condition ?? dto.estado;
    const stock = dto.stock ?? dto.volume;
    const price = dto.price;
    const discount = dto.discount ?? dto.desconto ?? 0;

    const product = await this.prisma.product.create({
      data: {
        image,
        name,
        description,
        category,
        size,
        condition,
        stock,
        price,
        discount,
      },
    });
    await this.invalidateCatalogCache();
    if (adminId) {
      await this.audit
        .register(adminId, 'create_product', 'product', product.id, {
          name,
          price,
          nome: name,
          preco: price,
        })
        .catch(() => {});
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto & any, adminId?: string): Promise<Product> {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    const image = dto.image ?? dto.imagem;
    const name = dto.name ?? dto.nomeProduto;
    const description = dto.description ?? dto.descricao;
    const category = dto.category ?? dto.categoria;
    const size = dto.size ?? dto.tamanho;
    const condition = dto.condition ?? dto.estado;
    const stock = dto.stock ?? dto.volume;
    const discount = dto.discount ?? dto.desconto;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(image !== undefined ? { image } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(condition !== undefined ? { condition } : {}),
        ...(stock !== undefined ? { stock } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(discount !== undefined ? { discount } : {}),
      },
    });
    await this.invalidateCatalogCache();
    if (adminId) {
      await this.audit
        .register(adminId, 'update_product', 'product', id, {
          before: exists,
          after: updated,
          antes: exists,
          depois: updated,
        })
        .catch(() => {});
    }
    return updated;
  }

  async remove(id: string, adminId?: string): Promise<{ message: string; mensagem: string }> {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    await this.prisma.product.delete({ where: { id } });
    await this.invalidateCatalogCache();
    if (adminId) {
      await this.audit
        .register(adminId, 'remove_product', 'product', id, {
          name: exists.name,
          nome: exists.name,
        })
        .catch(() => {});
    }
    return { message: 'Product removed successfully', mensagem: 'Produto removido com sucesso' };
  }
}

// legacy aliases
export const ProdutosAdminService = ProductsAdminService;
export type FiltrarProdutosDto = FilterProductsDto;
