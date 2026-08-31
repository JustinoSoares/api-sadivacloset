import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryType, OrderStatus, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function discountedPrice(price: number, discount: number): number {
  return Math.round(price - (price * discount) / 100);
}

export interface CheckoutInput {
  enderecoId?: string;
  zonaEntregaId?: string;
  tipo: string; // domicilio | levantamento_loja (already normalized)
  dataAgendada: string; // ISO date
  janelaHorario: string;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(buyerId: string, input: CheckoutInput) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { buyerId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException({
        error: { code: 'CART_EMPTY', message: 'Cart is empty' },
      });
    }

    const tipoNorm = input.tipo;
    let deliveryType: DeliveryType;
    if (tipoNorm === 'domicilio') deliveryType = DeliveryType.HOME_DELIVERY;
    else if (tipoNorm === 'levantamento_loja') deliveryType = DeliveryType.STORE_PICKUP;
    else {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation error',
          details: [{ field: 'type', errors: ['type must be domicilio or levantamento_loja'] }],
        },
      });
    }

    const scheduledDate = new Date(input.dataAgendada);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation error',
          details: [{ field: 'scheduledDate', errors: ['scheduledDate is invalid'] }],
        },
      });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedOnly = new Date(scheduledDate);
    schedOnly.setHours(0, 0, 0, 0);
    if (schedOnly < today) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation error',
          details: [{ field: 'scheduledDate', errors: ['scheduledDate cannot be in the past'] }],
        },
      });
    }

    if (!input.janelaHorario || !input.janelaHorario.trim()) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation error',
          details: [{ field: 'timeWindow', errors: ['timeWindow cannot be empty'] }],
        },
      });
    }

    let addressId: string | null = null;
    let deliveryFee = 0;

    if (deliveryType === DeliveryType.STORE_PICKUP) {
      addressId = null;
      deliveryFee = 0;
    } else {
      if (input.enderecoId) {
        const address = await this.prisma.address.findUnique({ where: { id: input.enderecoId } });
        if (!address || address.buyerId !== buyerId) {
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Address not found' },
          });
        }
        addressId = address.id;
        if (input.zonaEntregaId) {
          const zone = await this.prisma.deliveryZone.findUnique({
            where: { id: input.zonaEntregaId },
          });
          if (!zone) {
            throw new NotFoundException({
              error: { code: 'NOT_FOUND', message: 'Delivery zone not found' },
            });
          }
          deliveryFee = zone.price;
        } else {
          const zoneByNeighborhood = await this.prisma.deliveryZone.findUnique({
            where: { neighborhood: address.neighborhood },
          });
          if (zoneByNeighborhood) deliveryFee = zoneByNeighborhood.price;
          else {
            const prefs = await this.prisma.adminPreferences.findUnique({
              where: { id: 'singleton' },
            });
            deliveryFee = prefs?.defaultDeliveryFee ?? 0;
          }
        }
      } else if (input.zonaEntregaId) {
        const zone = await this.prisma.deliveryZone.findUnique({
          where: { id: input.zonaEntregaId },
        });
        if (!zone) {
          throw new NotFoundException({
            error: { code: 'NOT_FOUND', message: 'Delivery zone not found' },
          });
        }
        deliveryFee = zone.price;
        addressId = null;
      } else {
        const defaultAddress = await this.prisma.address.findFirst({
          where: { buyerId, isDefault: true },
        });
        if (defaultAddress) {
          addressId = defaultAddress.id;
          const zoneByNeighborhood = await this.prisma.deliveryZone.findUnique({
            where: { neighborhood: defaultAddress.neighborhood },
          });
          if (zoneByNeighborhood) deliveryFee = zoneByNeighborhood.price;
          else {
            const prefs = await this.prisma.adminPreferences.findUnique({
              where: { id: 'singleton' },
            });
            deliveryFee = prefs?.defaultDeliveryFee ?? 0;
          }
        } else {
          const prefs = await this.prisma.adminPreferences.findUnique({
            where: { id: 'singleton' },
          });
          deliveryFee = prefs?.defaultDeliveryFee ?? 0;
          addressId = null;
        }
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData: Array<{
        productId: string;
        productName: string;
        unitPrice: number;
        discount: number;
        quantity: number;
      }> = [];

      for (const item of cartItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new NotFoundException({
            error: {
              code: 'NOT_FOUND',
              message: `Product not found: ${item.productId}`,
            },
          });
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
              details: {
                productId: product.id,
                name: product.name,
                available: product.stock,
                requested: item.quantity,
              },
            },
          });
        }

        const unitDiscounted = discountedPrice(product.price, product.discount);
        subtotal += unitDiscounted * item.quantity;

        orderItemsData.push({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          discount: product.discount,
          quantity: item.quantity,
        });

        const dec = await (tx.product as any).updateMany({
          where: { id: product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (dec.count === 0) {
          throw new BadRequestException({
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
              details: {
                productId: product.id,
                name: product.name,
                available: product.stock,
                requested: item.quantity,
              },
            },
          });
        }
      }

      const total = subtotal + deliveryFee;

      const order = await tx.order.create({
        data: {
          buyerId,
          subtotal,
          deliveryFee,
          total,
          status: OrderStatus.AWAITING_PAYMENT,
          items: {
            create: orderItemsData.map((oi) => ({
              productId: oi.productId,
              productName: oi.productName,
              unitPrice: oi.unitPrice,
              discount: oi.discount,
              quantity: oi.quantity,
            })),
          },
          delivery: {
            create: {
              type: deliveryType,
              addressId,
              scheduledDate,
              timeWindow: input.janelaHorario,
              status: DeliveryStatus.SCHEDULED,
              deliveryFee,
            },
          },
        },
        include: { items: true, delivery: true },
      });

      await tx.cartItem.deleteMany({ where: { buyerId } });

      return {
        id: order.id,
        buyerId: order.buyerId,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items.map((it) => ({
          id: it.id,
          orderId: it.orderId,
          productId: it.productId,
          productName: it.productName,
          unitPrice: it.unitPrice,
          discount: it.discount,
          quantity: it.quantity,
        })),
        delivery: order.delivery
          ? {
              id: order.delivery.id,
              orderId: order.delivery.orderId,
              type: order.delivery.type,
              addressId: order.delivery.addressId,
              scheduledDate: order.delivery.scheduledDate,
              timeWindow: order.delivery.timeWindow,
              status: order.delivery.status,
              deliveryFee: order.delivery.deliveryFee,
            }
          : null,
      };
    });
  }
}
