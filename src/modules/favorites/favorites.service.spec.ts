import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService, FavoritosService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: {
    favorite: { findMany: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
    product: { findUnique: jest.Mock };
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const productMock = {
    id: productId,
    name: 'Classic Suit',
    price: 45000,
    discount: 0,
    stock: 10,
    image: 'https://cdn.com/a.jpg',
    description: 'Suit',
    category: 'SUITS',
    size: 'M',
    condition: 'NEW',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      favorite: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return products from favorites ordered desc', async () => {
      prisma.favorite.findMany.mockResolvedValue([
        { buyerId, productId, createdAt: new Date('2026-02-02'), product: productMock },
        { buyerId, productId: 'other', createdAt: new Date('2026-02-01'), product: { ...productMock, id: 'other' } },
      ]);

      const result = await service.findAll(buyerId);

      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { buyerId },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(productMock);
    });

    it('should return empty array when no favorites', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);
      const result = await service.findAll(buyerId);
      expect(result).toEqual([]);
    });
  });

  describe('add', () => {
    it('should upsert favorite idempotently', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.favorite.upsert.mockResolvedValue({ buyerId, productId });

      const result = await service.add(buyerId, productId);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: productId } });
      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { buyerId_productId: { buyerId, productId } },
        create: { buyerId, productId },
        update: {},
      });
      expect(result).toEqual(productMock);
    });

    it('should be idempotent - second call same upsert no error', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.favorite.upsert.mockResolvedValue({ buyerId, productId });

      await service.add(buyerId, productId);
      await service.add(buyerId, productId);

      expect(prisma.favorite.upsert).toHaveBeenCalledTimes(2);
    });

    it('should throw 404 if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.add(buyerId, 'non-existent')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.add(buyerId, 'non-existent')).rejects.toMatchObject({
        response: { erro: { codigo: 'NAO_ENCONTRADO' } },
      });
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should deleteMany idempotently', async () => {
      prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
      await service.remove(buyerId, productId);
      expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({ where: { buyerId, productId } });
    });

    it('should not throw if not exists (idempotent delete)', async () => {
      prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(buyerId, productId)).resolves.toBeUndefined();
      expect(prisma.favorite.deleteMany).toHaveBeenCalled();
    });
  });

  it('legacy FavoritosService alias should exist', () => {
    expect(FavoritosService).toBeDefined();
    expect(FavoritosService).toBe(FavoritesService);
  });
});
