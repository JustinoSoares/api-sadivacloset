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
        produto_id: item.productId,
        product_id: item.productId,
        productId: item.productId,
        quantidade: item.quantity,
        quantity: item.quantity,
        produto: item.product,
        product: item.product,
        preco_com_desconto: unit,
        price_with_discount: unit,
        subtotal_item: subtotalItem,
        subtotalItem: subtotalItem,
      };
    });

    const subtotal = enriched.reduce((acc, cur) => acc + cur.subtotal_item, 0);
    const totalItens = enriched.length;
    const totalQuantidade = enriched.reduce((acc, cur) => acc + cur.quantidade, 0);

    return {
      itens: enriched,
      items: enriched,
      subtotal,
      total_itens: totalItens,
      totalItens,
      total_quantidade: totalQuantidade,
      totalQuantity: totalQuantidade,
    };
  }

  async addItem(buyerId: string, productId: string, quantidade: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    if (quantidade > product.stock) {
      throw new BadRequestException({
        erro: {
          codigo: 'STOCK_INSUFICIENTE',
          mensagem: `Stock insuficiente. Disponível: ${product.stock}, solicitado: ${quantidade}`,
          detalhes: { disponivel: product.stock, solicitado: quantidade },
        },
      });
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { buyerId_productId: { buyerId, productId } },
    });

    if (existing) {
      const novaQuantidade = existing.quantity + quantidade;
      if (novaQuantidade > product.stock) {
        throw new BadRequestException({
          erro: {
            codigo: 'STOCK_INSUFICIENTE',
            mensagem: `Stock insuficiente. Disponível: ${product.stock}, no carrinho: ${existing.quantity}, solicitado adicional: ${quantidade} (total ${novaQuantidade})`,
            detalhes: {
              disponivel: product.stock,
              noCarrinho: existing.quantity,
              solicitado: quantidade,
              total: novaQuantidade,
            },
          },
        });
      }
      const updated = await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: novaQuantidade },
        include: { product: true },
      });
      const unit = discountedPrice(updated.product.price, updated.product.discount);
      return {
        id: updated.id,
        produto_id: updated.productId,
        product_id: updated.productId,
        quantidade: updated.quantity,
        quantity: updated.quantity,
        produto: updated.product,
        product: updated.product,
        preco_com_desconto: unit,
        subtotal_item: unit * updated.quantity,
      };
    }

    const created = await this.prisma.cartItem.create({
      data: { buyerId, productId, quantity: quantidade },
      include: { product: true },
    });
    const unit = discountedPrice(created.product.price, created.product.discount);
    return {
      id: created.id,
      produto_id: created.productId,
      product_id: created.productId,
      quantidade: created.quantity,
      quantity: created.quantity,
      produto: created.product,
      product: created.product,
      preco_com_desconto: unit,
      subtotal_item: unit * created.quantity,
    };
  }

  async updateItem(buyerId: string, itemId: string, quantidade: number) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item || item.buyerId !== buyerId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Item do carrinho não encontrado' },
      });
    }

    if (quantidade > item.product.stock) {
      throw new BadRequestException({
        erro: {
          codigo: 'STOCK_INSUFICIENTE',
          mensagem: `Stock insuficiente. Disponível: ${item.product.stock}, solicitado: ${quantidade}`,
          detalhes: { disponivel: item.product.stock, solicitado: quantidade },
        },
      });
    }

    const updated = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: quantidade },
      include: { product: true },
    });
    const unit = discountedPrice(updated.product.price, updated.product.discount);
    return {
      id: updated.id,
      produto_id: updated.productId,
      product_id: updated.productId,
      quantidade: updated.quantity,
      quantity: updated.quantity,
      produto: updated.product,
      product: updated.product,
      preco_com_desconto: unit,
      subtotal_item: unit * updated.quantity,
    };
  }

  async removeItem(buyerId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.buyerId !== buyerId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Item do carrinho não encontrado' },
      });
    }
    await this.prisma.cartItem.delete({ where: { id: itemId } });
  }
}

export const CarrinhoService = CartService;
