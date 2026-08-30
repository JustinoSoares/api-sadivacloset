import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let prisma: any;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const addressId = '33333333-3333-3333-3333-333333333333';
  const zoneId = '44444444-4444-4444-4444-444444444444';

  const productMock = {
    id: productId,
    name: 'Classic Black Suit',
    price: 45000,
    discount: 10,
    stock: 10,
  };

  const cartItemMock = {
    id: 'cart1',
    buyerId,
    productId,
    quantity: 2,
    product: productMock,
  };

  const addressMock = {
    id: addressId,
    buyerId,
    neighborhood: 'Benfica',
  };

  const zoneMock = { id: zoneId, neighborhood: 'Benfica', price: 2200 };

  beforeEach(async () => {
    prisma = {
      cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
      product: { findUnique: jest.fn(), update: jest.fn() },
      address: { findUnique: jest.fn(), findFirst: jest.fn() },
      deliveryZone: { findUnique: jest.fn() },
      adminPreferences: { findUnique: jest.fn() },
      order: { create: jest.fn() },
      $transaction: jest.fn(async (cb) => {
        const tx = {
          product: {
            findUnique: jest.fn().mockResolvedValue(productMock),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          order: {
            create: jest.fn().mockResolvedValue({
              id: 'order1',
              buyerId,
              subtotal: 81000,
              deliveryFee: 2200,
              total: 83200,
              status: 'AWAITING_PAYMENT',
              createdAt: new Date(),
              items: [
                {
                  id: 'oi1',
                  productId,
                  productName: productMock.name,
                  unitPrice: productMock.price,
                  discount: productMock.discount,
                  quantity: 2,
                },
              ],
              delivery: {
                id: 'del1',
                orderId: 'order1',
                type: 'HOME_DELIVERY',
                addressId,
                scheduledDate: new Date('2026-09-01'),
                timeWindow: '09:00-12:00',
                status: 'SCHEDULED',
                deliveryFee: 2200,
              },
            }),
          },
          cartItem: { deleteMany: jest.fn().mockResolvedValue({}) },
        };
        // allow overriding tx behavior
        if (prisma.__txProduct) tx.product.findUnique = prisma.__txProduct;
        if (prisma.__txProductUpdate) tx.product.update = prisma.__txProductUpdate;
        return cb(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckoutService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create order successfully (domicilio com endereco_id)', async () => {
    prisma.cartItem.findMany.mockResolvedValue([cartItemMock]);
    prisma.address.findUnique.mockResolvedValue(addressMock);
    prisma.deliveryZone.findUnique.mockResolvedValue(zoneMock);

    const result = await service.checkout(buyerId, {
      enderecoId: addressId,
      tipo: 'domicilio',
      dataAgendada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      janelaHorario: '09:00-12:00',
    });

    expect(result.id).toBe('order1');
    expect(result.taxa_entrega).toBe(2200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should throw CARRINHO_VAZIO if empty', async () => {
    prisma.cartItem.findMany.mockResolvedValue([]);
    await expect(
      service.checkout(buyerId, {
        tipo: 'domicilio',
        dataAgendada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        janelaHorario: '09:00-12:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.checkout(buyerId, {
        tipo: 'domicilio',
        dataAgendada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        janelaHorario: '09:00-12:00',
      }),
    ).rejects.toMatchObject({ response: { erro: { codigo: 'CARRINHO_VAZIO' } } });
  });

  it('should block if stock insuficiente and cancel transaction', async () => {
    prisma.cartItem.findMany.mockResolvedValue([cartItemMock]);
    prisma.address.findUnique.mockResolvedValue(addressMock);
    prisma.deliveryZone.findUnique.mockResolvedValue(zoneMock);
    // mock inside transaction product with low stock
    const lowStockProduct = { ...productMock, stock: 1 };
    prisma.__txProduct = jest.fn().mockResolvedValue(lowStockProduct);

    await expect(
      service.checkout(buyerId, {
        enderecoId: addressId,
        tipo: 'domicilio',
        dataAgendada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        janelaHorario: '09:00-12:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.checkout(buyerId, {
        enderecoId: addressId,
        tipo: 'domicilio',
        dataAgendada: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        janelaHorario: '09:00-12:00',
      }),
    ).rejects.toMatchObject({ response: { erro: { codigo: 'STOCK_INSUFICIENTE' } } });
    // ensure product update not called beyond validation (transaction would abort)
  });

  it('should handle levantamento_loja with taxa 0', async () => {
    prisma.cartItem.findMany.mockResolvedValue([cartItemMock]);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    // mock transaction to capture deliveryFee 0
    prisma.$transaction = jest.fn(async (cb) => {
      const tx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(productMock),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        order: {
          create: jest.fn().mockImplementation(async (args) => {
            expect(args.data.delivery.create.deliveryFee).toBe(0);
            expect(args.data.delivery.create.type).toBe('STORE_PICKUP');
            return {
              id: 'order2',
              buyerId,
              subtotal: 81000,
              deliveryFee: 0,
              total: 81000,
              status: 'AWAITING_PAYMENT',
              createdAt: new Date(),
              items: [],
              delivery: {
                id: 'del2',
                orderId: 'order2',
                type: 'STORE_PICKUP',
                addressId: null,
                scheduledDate: new Date(tomorrow),
                timeWindow: '14:00-18:00',
                status: 'SCHEDULED',
                deliveryFee: 0,
              },
            };
          }),
        },
        cartItem: { deleteMany: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const result = await service.checkout(buyerId, {
      tipo: 'levantamento_loja',
      dataAgendada: tomorrow,
      janelaHorario: '14:00-18:00',
    });
    expect(result.deliveryFee).toBe(0);
  });

  it('should use zona_entrega_id when provided', async () => {
    prisma.cartItem.findMany.mockResolvedValue([cartItemMock]);
    prisma.deliveryZone.findUnique.mockResolvedValue(zoneMock);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    prisma.$transaction = jest.fn(async (cb) => {
      const tx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(productMock),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        order: {
          create: jest.fn().mockImplementation(async (args) => {
            expect(args.data.deliveryFee).toBe(2200);
            return {
              id: 'order3',
              buyerId,
              subtotal: 81000,
              deliveryFee: 2200,
              total: 83200,
              status: 'AWAITING_PAYMENT',
              createdAt: new Date(),
              items: [],
              delivery: {
                id: 'del3',
                orderId: 'order3',
                type: 'HOME_DELIVERY',
                addressId: null,
                scheduledDate: new Date(tomorrow),
                timeWindow: '09:00-12:00',
                status: 'SCHEDULED',
                deliveryFee: 2200,
              },
            };
          }),
        },
        cartItem: { deleteMany: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const result = await service.checkout(buyerId, {
      zonaEntregaId: zoneId,
      tipo: 'domicilio',
      dataAgendada: tomorrow,
      janelaHorario: '09:00-12:00',
    });
    expect(result.deliveryFee).toBe(2200);
  });
});
