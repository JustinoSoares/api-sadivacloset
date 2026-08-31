import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService, CarrinhoService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CartService', () => {
  let service: CartService;
  let prisma: {
    cartItem: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    product: { findUnique: jest.Mock };
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const cartItemId = '33333333-3333-3333-3333-333333333333';

  const productMock = {
    id: productId,
    name: 'Suit',
    price: 45000,
    discount: 10, // discounted 40500
    stock: 10,
    image: 'https://cdn.com/a.jpg',
    description: 'Suit',
    category: 'SUITS',
    size: 'M',
    condition: 'NEW',
    createdAt: new Date(),
  };

  const productMock2 = {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Dress',
    price: 20000,
    discount: 0, // 20000
    stock: 5,
    image: 'https://cdn.com/b.jpg',
    description: 'Dress',
    category: 'DRESSES',
    size: 'S',
    condition: 'NEW',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      cartItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getCart', () => {
    it('should return itens with subtotal (discounted * quantity)', async () => {
      prisma.cartItem.findMany.mockResolvedValue([
        { id: cartItemId, buyerId, productId, quantity: 2, product: productMock },
        { id: '4444', buyerId, productId: productMock2.id, quantity: 1, product: productMock2 },
      ]);

      const result = await service.getCart(buyerId);

      expect(prisma.cartItem.findMany).toHaveBeenCalledWith({
        where: { buyerId },
        include: { product: true },
        orderBy: { productId: 'asc' },
      });
      // discounted suit 40500*2=81000, dress 20000*1=20000 => subtotal 101000
      expect(result.subtotal).toBe(101000);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].priceWithDiscount).toBe(40500);
      expect(result.items[0].subtotal).toBe(81000);
      expect(result.totalItems).toBe(2);
      expect(result.totalQuantity).toBe(3);
    });

    it('should return empty cart with subtotal 0', async () => {
      prisma.cartItem.findMany.mockResolvedValue([]);
      const result = await service.getCart(buyerId);
      expect(result.subtotal).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('addItem', () => {
    it('should create new item when not exists', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.cartItem.findUnique.mockResolvedValue(null);
      prisma.cartItem.create.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 2,
        product: productMock,
      });

      const result = await service.addItem(buyerId, productId, 2);

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: { buyerId, productId, quantity: 2 },
        include: { product: true },
      });
      expect(result.quantity).toBe(2);
      expect(result.priceWithDiscount).toBe(40500);
    });

    it('should increment quantity if already exists (idempotent additive)', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 3,
      });
      prisma.cartItem.update.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 5,
        product: productMock,
      });

      const result = await service.addItem(buyerId, productId, 2);

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: cartItemId },
        data: { quantity: 5 },
        include: { product: true },
      });
      expect(result.quantity).toBe(5);
    });

    it('should throw 404 if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.addItem(buyerId, productId, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw 400 if quantidade > stock (new item)', async () => {
      prisma.product.findUnique.mockResolvedValue({ ...productMock, stock: 1 });
      await expect(service.addItem(buyerId, productId, 2)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.addItem(buyerId, productId, 2)).rejects.toMatchObject({
        response: { error: { code: 'INSUFFICIENT_STOCK' } },
      });
    });

    it('should throw 400 if total quantidade exceeds stock on increment', async () => {
      prisma.product.findUnique.mockResolvedValue({ ...productMock, stock: 4 });
      prisma.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 3,
      });
      await expect(service.addItem(buyerId, productId, 2)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('updateItem', () => {
    it('should update quantity with stock validation', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 1,
        product: productMock,
      });
      prisma.cartItem.update.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 5,
        product: productMock,
      });

      const result = await service.updateItem(buyerId, cartItemId, 5);
      expect(result.quantity).toBe(5);
      expect(result.priceWithDiscount).toBe(40500);
    });

    it('should throw 404 if item not found or not owner', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);
      await expect(service.updateItem(buyerId, cartItemId, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        buyerId: 'other',
        productId,
        quantity: 1,
        product: productMock,
      });
      await expect(service.updateItem(buyerId, cartItemId, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw 400 if quantidade > stock', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        buyerId,
        productId,
        quantity: 1,
        product: { ...productMock, stock: 2 },
      });
      await expect(service.updateItem(buyerId, cartItemId, 5)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.updateItem(buyerId, cartItemId, 5)).rejects.toMatchObject({
        response: { error: { code: 'INSUFFICIENT_STOCK' } },
      });
    });
  });

  describe('removeItem', () => {
    it('should delete item if owner', async () => {
      prisma.cartItem.findUnique.mockResolvedValue({ id: cartItemId, buyerId, productId });
      prisma.cartItem.delete.mockResolvedValue({});
      await service.removeItem(buyerId, cartItemId);
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: cartItemId } });
    });

    it('should throw 404 if not found or not owner', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);
      await expect(service.removeItem(buyerId, cartItemId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.cartItem.findUnique.mockResolvedValue({ id: cartItemId, buyerId: 'other', productId });
      await expect(service.removeItem(buyerId, cartItemId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('legacy CarrinhoService alias should exist', () => {
    expect(CarrinhoService).toBeDefined();
    expect(CarrinhoService).toBe(CartService);
  });
});
