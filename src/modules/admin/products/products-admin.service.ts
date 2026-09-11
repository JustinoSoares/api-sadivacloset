import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

    return buildPaginatedResponse(data as any, total, query as any);
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
        })
        .catch(() => {});
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto & any, adminId?: string): Promise<Product> {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
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
        })
        .catch(() => {});
    }
    return updated;
  }

  async remove(id: string, adminId?: string): Promise<{ message: string }> {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    // Prevent hard delete when product is referenced by order_items (FK Restrict).
    // Keep order history intact; admin should archive/deactivate instead.
    const orderItemsCount =
      (await (this.prisma as any).orderItem?.count?.({
        where: { productId: id },
      })) ?? 0;
    if (orderItemsCount > 0) {
      throw new ConflictException({
        error: {
          code: 'PRODUCT_IN_USE',
          message:
            'Não é possível eliminar o produto porque já está associado a encomendas. Considere arquivar o produto definindo o stock como 0.',
        },
      });
    }

    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error: any) {
      // Race condition: order was created between the count check and delete.
      // Prisma maps Postgres 23001 / FK_RESTRICT to P2003
      if (
        error?.code === 'P2003' ||
        error?.code === '23001' ||
        error?.meta?.field_name?.includes('order_items') ||
        String(error?.message ?? '').includes('order_items_product_id_fkey') ||
        String(error?.message ?? '').includes('violates RESTRICT')
      ) {
        throw new ConflictException({
          error: {
            code: 'PRODUCT_IN_USE',
            message:
              'Não é possível eliminar o produto porque já está associado a encomendas. Considere arquivar o produto definindo o stock como 0.',
          },
        });
      }
      throw error;
    }
    await this.invalidateCatalogCache();
    if (adminId) {
      await this.audit
        .register(adminId, 'remove_product', 'product', id, {
          name: exists.name,
        })
        .catch(() => {});
    }
    return { message: 'Product removed successfully' };
  }
}

// legacy aliases
export const ProdutosAdminService = ProductsAdminService;
export type FiltrarProdutosDto = FilterProductsDto;
