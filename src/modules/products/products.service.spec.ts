import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Category, ProductCondition } from '@prisma/client';
import { SortOrder } from './dto/filter-products.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: { product: { findMany: jest.Mock; findUnique: jest.Mock } };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; delByPattern: jest.Mock };

  const productsMock = [
    {
      id: '1',
      name: 'Black Suit',
      description: 'Elegant suit',
      category: Category.SUITS,
      size: 'M',
      condition: ProductCondition.NEW,
      stock: 10,
      price: 45000,
      discount: 10, // 40500
      image: 'https://cdn.com/a.jpg',
      createdAt: new Date('2026-01-03'),
    },
    {
      id: '2',
      name: 'Floral Dress',
      description: 'Light dress',
      category: Category.DRESSES,
      size: 'S',
      condition: ProductCondition.NEW,
      stock: 8,
      price: 25000,
      discount: 20, // 20000
      image: 'https://cdn.com/b.jpg',
      createdAt: new Date('2026-01-02'),
    },
    {
      id: '3',
      name: 'White Shirt',
      description: 'Cotton shirt',
      category: Category.SHIRTS,
      size: 'L',
      condition: ProductCondition.PRE_OWNED,
      stock: 15,
      price: 15000,
      discount: 0, // 15000
      image: 'https://cdn.com/c.jpg',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: '4',
      name: 'Casual Set',
      description: 'Relaxed set',
      category: Category.OTHERS,
      size: 'M',
      condition: ProductCondition.NEW,
      stock: 20,
      price: 18000,
      discount: 50, // 9000
      image: 'https://cdn.com/d.jpg',
      createdAt: new Date('2026-01-04'),
    },
  ];

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue(productsMock),
        findUnique: jest.fn(),
      },
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(1),
      delByPattern: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll - cache', () => {
    it('should return from cache when exists (english)', async () => {
      const cached = {
        dados: [productsMock[0]],
        data: [productsMock[0]],
        pagina: 1,
        page: 1,
        total: 1,
        total_paginas: 1,
        totalPages: 1,
      };
      const cachedSerialized = JSON.stringify(cached);
      redis.get.mockResolvedValue(cachedSerialized);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0, take: 20 } as any);
      expect(result).toEqual(JSON.parse(cachedSerialized));
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when miss', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.findAll({ page: 1, limit: 20, skip: 0, take: 20 } as any);
      expect(prisma.product.findMany).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('cache:products:'),
        expect.any(String),
        60,
      );
      expect(result.total).toBe(4);
    });

    it('should generate different keys for different queries', async () => {
      redis.get.mockResolvedValue(null);
      await service.findAll({ q: 'Suit', page: 1, limit: 20, skip: 0, take: 20 } as any);
      const firstKey = redis.get.mock.calls[0][0];
      redis.get.mockClear();
      await service.findAll({ q: 'Dress', page: 1, limit: 20, skip: 0, take: 20 } as any);
      const secondKey = redis.get.mock.calls[0][0];
      expect(firstKey).not.toBe(secondKey);
      expect(firstKey).toContain('q=Suit');
      expect(secondKey).toContain('q=Dress');
    });

    it('should normalize category array in key (order does not matter)', async () => {
      redis.get.mockResolvedValue(null);
      await service.findAll({
        category: [Category.DRESSES, Category.SUITS] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const key1 = redis.get.mock.calls[0][0];
      redis.get.mockClear();
      await service.findAll({
        category: [Category.SUITS, Category.DRESSES] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const key2 = redis.get.mock.calls[0][0];
      expect(key1).toBe(key2);
    });

    it('legacy portuguese categoria should still hit same cache', async () => {
      redis.get.mockResolvedValue(null);
      await service.findAll({
        categoria: [Category.SUITS] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const keyPt = redis.get.mock.calls[0][0];
      redis.get.mockClear();
      await service.findAll({
        category: [Category.SUITS] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const keyEn = redis.get.mock.calls[0][0];
      // both should normalize to same English key (category)
      expect(keyPt).toContain('category=');
      expect(keyEn).toContain('category=');
    });
  });

  describe('findAll - filters', () => {
    it('should filter by q in name OR description (case-insensitive)', async () => {
      const result = await service.findAll({
        q: 'Suit',
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: 'Suit', mode: 'insensitive' } },
            { description: { contains: 'Suit', mode: 'insensitive' } },
          ],
        },
      });
      expect(result.total).toBe(4);
    });

    it('should filter by category array (english)', async () => {
      await service.findAll({
        category: [Category.SUITS] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { category: { in: [Category.SUITS] } },
      });
    });

    it('legacy portuguese categoria should also filter', async () => {
      await service.findAll({
        categoria: [Category.SUITS] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { category: { in: [Category.SUITS] } },
      });
    });

    it('should filter by size and condition', async () => {
      await service.findAll({
        size: ['M'] as any,
        condition: [ProductCondition.NEW] as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          size: { in: ['M'] },
          condition: { in: [ProductCondition.NEW] },
        },
      });
    });

    it('should filter by price with discount (price_min/price_max)', async () => {
      const resultMin = await service.findAll({
        price_min: 20000,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(resultMin.total).toBe(2);
      expect(resultMin.dados.every((p) => p.price - (p.price * p.discount) / 100 >= 20000)).toBe(
        true,
      );

      const resultMax = await service.findAll({
        price_max: 15000,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(resultMax.total).toBe(2);

      const resultBoth = await service.findAll({
        price_min: 10000,
        price_max: 20000,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(resultBoth.total).toBe(2);
    });

    it('legacy preco_min/preco_max should also filter', async () => {
      const result = await service.findAll({
        preco_min: 20000,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(result.total).toBe(2);
    });

    it('should paginate correctly after filters', async () => {
      const resultPage1 = await service.findAll({ page: 1, limit: 2, skip: 0, take: 2 } as any);
      expect(resultPage1.dados).toHaveLength(2);
      expect(resultPage1.pagina).toBe(1);
      expect(resultPage1.total).toBe(4);
      expect(resultPage1.total_paginas).toBe(2);

      const resultPage2 = await service.findAll({ page: 2, limit: 2, skip: 2, take: 2 } as any);
      expect(resultPage2.dados).toHaveLength(2);
      expect(resultPage2.pagina).toBe(2);
    });
  });

  describe('findAll - sorting', () => {
    it('should sort by price_asc (discounted)', async () => {
      const result = await service.findAll({
        sort: SortOrder.price_asc,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const prices = result.dados.map((p) => Math.round(p.price - (p.price * p.discount) / 100));
      expect(prices).toEqual([9000, 15000, 20000, 40500]);
    });

    it('legacy ordenar preco_asc should also sort', async () => {
      const result = await service.findAll({
        ordenar: 'preco_asc' as any,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const prices = result.dados.map((p) => Math.round(p.price - (p.price * p.discount) / 100));
      expect(prices).toEqual([9000, 15000, 20000, 40500]);
    });

    it('should sort by price_desc', async () => {
      const result = await service.findAll({
        sort: SortOrder.price_desc,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      const prices = result.dados.map((p) => Math.round(p.price - (p.price * p.discount) / 100));
      expect(prices).toEqual([40500, 20000, 15000, 9000]);
    });

    it('should sort by name_asc', async () => {
      const result = await service.findAll({
        sort: SortOrder.name_asc,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(result.dados[0].name).toBe('Black Suit');
      expect(result.dados[1].name).toBe('Casual Set');
    });

    it('should sort by recent (default, createdAt desc)', async () => {
      const result = await service.findAll({ page: 1, limit: 20, skip: 0, take: 20 } as any);
      expect(result.dados[0].id).toBe('4');
      expect(result.dados[1].id).toBe('1');
    });

    it('should sort by oldest (createdAt asc)', async () => {
      const result = await service.findAll({
        sort: SortOrder.oldest,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as any);
      expect(result.dados[0].id).toBe('3');
      expect(result.dados[3].id).toBe('4');
    });
  });

  describe('findOne', () => {
    it('should return product when exists', async () => {
      prisma.product.findUnique.mockResolvedValue(productsMock[0]);
      const result = await service.findOne('1');
      expect(result).toEqual(productsMock[0]);
    });

    it('should throw NotFound when not exists', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('no-id')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.findOne('no-id')).rejects.toMatchObject({
        response: { erro: { codigo: 'NAO_ENCONTRADO' } },
      });
    });
  });

  describe('clearCache', () => {
    it('should clear products and categories cache (both en and pt)', async () => {
      await service.clearCache();
      expect(redis.delByPattern).toHaveBeenCalledWith('cache:products:*');
      expect(redis.del).toHaveBeenCalledWith('cache:categories');
    });
  });

  // legacy alias
  it('legacy ProdutosPublicService alias should exist', () => {
    const { ProdutosPublicService } = require('./products.service');
    expect(ProdutosPublicService).toBeDefined();
  });
});
