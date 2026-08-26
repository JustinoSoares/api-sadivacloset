import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(buyerId: string): Promise<Product[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { buyerId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((f) => f.product);
  }

  async add(buyerId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    await this.prisma.favorite.upsert({
      where: { buyerId_productId: { buyerId, productId } },
      create: { buyerId, productId },
      update: {},
    });

    return product;
  }

  async remove(buyerId: string, productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: { buyerId, productId },
    });
  }
}

// legacy aliases
export const FavoritosService = FavoritesService;
