import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryType, OrderStatus, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function discountedPrice(price: number, discount: number): number {
  return Math.round(price - (price * discount) / 100);
}

export interface CheckoutInput {
  enderecoId?: string;
  zonaEntregaId?: string;
  tipo: string; // domicilio | levantamento_loja (já normalizado)
  dataAgendada: string; // ISO date
  janelaHorario: string;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(buyerId: string, input: CheckoutInput) {
    // Validação pré-transação: carrinho não vazio
    const cartItems = await this.prisma.cartItem.findMany({
      where: { buyerId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException({
        erro: { codigo: 'CARRINHO_VAZIO', mensagem: 'Carrinho vazio' },
      });
    }

    // Resolver tipo
    const tipoNorm = input.tipo; // domicilio | levantamento_loja
    let deliveryType: DeliveryType;
    if (tipoNorm === 'domicilio') deliveryType = DeliveryType.HOME_DELIVERY;
    else if (tipoNorm === 'levantamento_loja') deliveryType = DeliveryType.STORE_PICKUP;
    else {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'tipo', erros: ['tipo deve ser domicilio ou levantamento_loja'] }],
        },
      });
    }

    // Validar data_agendada não no passado (comparando só data)
    const scheduledDate = new Date(input.dataAgendada);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'data_agendada', erros: ['data_agendada inválida'] }],
        },
      });
    }
    // normaliza para meia-noite UTC para comparar datas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const schedOnly = new Date(scheduledDate);
    schedOnly.setHours(0, 0, 0, 0);
    if (schedOnly < today) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'data_agendada', erros: ['data_agendada não pode ser no passado'] }],
        },
      });
    }

    // Validar janela_horario já feita pelo DTO, mas garante não vazia
    if (!input.janelaHorario || !input.janelaHorario.trim()) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'janela_horario', erros: ['janela_horario não pode ser vazia'] }],
        },
      });
    }

    // Resolver endereço e taxa de entrega (fora da transação para leituras)
    let addressId: string | null = null;
    let deliveryFee = 0;

    if (deliveryType === DeliveryType.STORE_PICKUP) {
      // levantamento: sem endereço, taxa 0
      addressId = null;
      deliveryFee = 0;
    } else {
      // domicilio: precisa resolver endereço e taxa
      if (input.enderecoId) {
        const address = await this.prisma.address.findUnique({ where: { id: input.enderecoId } });
        if (!address || address.buyerId !== buyerId) {
          throw new NotFoundException({
            erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endereço não encontrado' },
          });
        }
        addressId = address.id;
        // tenta zona pelo bairro do endereço
        if (input.zonaEntregaId) {
          const zone = await this.prisma.deliveryZone.findUnique({
            where: { id: input.zonaEntregaId },
          });
          if (!zone) {
            throw new NotFoundException({
              erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Zona de entrega não encontrada' },
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
            erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Zona de entrega não encontrada' },
          });
        }
        deliveryFee = zone.price;
        addressId = null;
      } else {
        // nenhum dos dois fornecido: tenta usar endereço predefinido
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
          // sem endereço e sem zona: fallback taxa padrão
          const prefs = await this.prisma.adminPreferences.findUnique({
            where: { id: 'singleton' },
          });
          deliveryFee = prefs?.defaultDeliveryFee ?? 0;
          addressId = null;
        }
      }
    }

    // Transação: valida stock, decrementa, cria pedido + itens + entrega, esvazia carrinho
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
        // revalida produto dentro da transação
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new NotFoundException({
            erro: {
              codigo: 'NAO_ENCONTRADO',
              mensagem: `Produto não encontrado: ${item.productId}`,
            },
          });
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException({
            erro: {
              codigo: 'STOCK_INSUFICIENTE',
              mensagem: `Stock insuficiente para "${product.name}". Disponível: ${product.stock}, solicitado: ${item.quantity}`,
              detalhes: {
                produto_id: product.id,
                product_id: product.id,
                nome: product.name,
                name: product.name,
                disponivel: product.stock,
                solicitado: item.quantity,
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

        // decremento atómico: só sucede se stock >= quantidade (evita corrida)
        const dec = await (tx.product as any).updateMany({
          where: { id: product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (dec.count === 0) {
          throw new BadRequestException({
            erro: {
              codigo: 'STOCK_INSUFICIENTE',
              mensagem: `Stock insuficiente para "${product.name}". Disponível: ${product.stock}, solicitado: ${item.quantity}`,
              detalhes: {
                produto_id: product.id,
                product_id: product.id,
                nome: product.name,
                name: product.name,
                disponivel: product.stock,
                solicitado: item.quantity,
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

      // esvazia carrinho
      await tx.cartItem.deleteMany({ where: { buyerId } });

      // retorno bilíngue
      return {
        id: order.id,
        pedido_id: order.id,
        order_id: order.id,
        comprador_id: order.buyerId,
        buyer_id: order.buyerId,
        buyerId: order.buyerId,
        subtotal: order.subtotal,
        taxa_entrega: order.deliveryFee,
        delivery_fee: order.deliveryFee,
        deliveryFee: order.deliveryFee,
        total: order.total,
        estado: order.status,
        status: order.status,
        criado_em: order.createdAt,
        created_at: order.createdAt,
        createdAt: order.createdAt,
        itens: order.items.map((it) => ({
          id: it.id,
          produto_id: it.productId,
          product_id: it.productId,
          productId: it.productId,
          nome_produto: it.productName,
          product_name: it.productName,
          productName: it.productName,
          preco_unitario: it.unitPrice,
          unit_price: it.unitPrice,
          unitPrice: it.unitPrice,
          desconto: it.discount,
          discount: it.discount,
          quantidade: it.quantity,
          quantity: it.quantity,
        })),
        items: order.items.map((it) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          unitPrice: it.unitPrice,
          discount: it.discount,
          quantity: it.quantity,
        })),
        entrega: order.delivery
          ? {
              id: order.delivery.id,
              pedido_id: order.delivery.orderId,
              order_id: order.delivery.orderId,
              orderId: order.delivery.orderId,
              tipo: order.delivery.type,
              type: order.delivery.type,
              endereco_id: order.delivery.addressId,
              address_id: order.delivery.addressId,
              addressId: order.delivery.addressId,
              data_agendada: order.delivery.scheduledDate,
              scheduled_date: order.delivery.scheduledDate,
              scheduledDate: order.delivery.scheduledDate,
              janela_horario: order.delivery.timeWindow,
              time_window: order.delivery.timeWindow,
              timeWindow: order.delivery.timeWindow,
              estado: order.delivery.status,
              status: order.delivery.status,
              taxa_entrega: order.delivery.deliveryFee,
              delivery_fee: order.delivery.deliveryFee,
              deliveryFee: order.delivery.deliveryFee,
            }
          : null,
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
