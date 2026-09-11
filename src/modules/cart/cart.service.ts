import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function discountedPrice(price: number, discount: number): number {
  return Math.round(price - (price * discount) / 100);
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(buyerId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { buyerId },
      include: { product: true },
      orderBy: { productId: 'asc' },
    });

    const enriched = items.map((item) => {
      const unit = discountedPrice(item.product.price, item.product.discount);
      const subtotalItem = unit * item.quantity;
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: item.product,
        priceWithDiscount: unit,
        subtotal: subtotalItem,
      };
    });

    const subtotal = enriched.reduce((acc, cur) => acc + cur.subtotal, 0);
    const totalItems = enriched.length;
    const totalQuantity = enriched.reduce((acc, cur) => acc + cur.quantity, 0);

    return {
      items: enriched,
      subtotal,
      totalItems,
      totalQuantity,
    };
  }

  async addItem(buyerId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Produto não encontrado.' },
      });
    }

    if (quantity > product.stock) {
      throw new BadRequestException({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Estoque insuficiente. Disponível: ${product.stock}, solicitado: ${quantity}`,
          details: { available: product.stock, requested: quantity },
        },
      });
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { buyerId_productId: { buyerId, productId } },
    });

    if (existing) {
      const newQuantity = existing.quantity + quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Estoque insuficiente. Disponível: ${product.stock}, no carrinho: ${existing.quantity}, solicitado adicional: ${quantity} (total ${newQuantity})`,
            details: {
              available: product.stock,
              inCart: existing.quantity,
              requested: quantity,
              total: newQuantity,
            },
          },
        });
      }
      const updated = await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
        include: { product: true },
      });
      const unit = discountedPrice(updated.product.price, updated.product.discount);
      return {
        id: updated.id,
        productId: updated.productId,
        quantity: updated.quantity,
        product: updated.product,
        priceWithDiscount: unit,
        subtotal: unit * updated.quantity,
      };
    }

    const created = await this.prisma.cartItem.create({
      data: { buyerId, productId, quantity },
      include: { product: true },
    });
    const unit = discountedPrice(created.product.price, created.product.discount);
    return {
      id: created.id,
      productId: created.productId,
      quantity: created.quantity,
      product: created.product,
      priceWithDiscount: unit,
      subtotal: unit * created.quantity,
    };
  }

  async updateItem(buyerId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item || item.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item do carrinho não encontrado.' },
      });
    }

    if (quantity > item.product.stock) {
      throw new BadRequestException({
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Estoque insuficiente. Disponível: ${item.product.stock}, solicitado: ${quantity}`,
          details: { available: item.product.stock, requested: quantity },
        },
      });
    }

    const updated = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: { product: true },
    });
    const unit = discountedPrice(updated.product.price, updated.product.discount);
    return {
      id: updated.id,
      productId: updated.productId,
      quantity: updated.quantity,
      product: updated.product,
      priceWithDiscount: unit,
      subtotal: unit * updated.quantity,
    };
  }

  async removeItem(buyerId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Item do carrinho não encontrado.' },
      });
    }
    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  async clearCart(buyerId: string) {
    await this.prisma.cartItem.deleteMany({ where: { buyerId } });
  }
}

export const CarrinhoService = CartService;
