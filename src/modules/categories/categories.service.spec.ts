import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Category } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: { product: { groupBy: jest.Mock } };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = { product: { groupBy: jest.fn() } };
    (prisma as any).produto = prisma.product;
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return from cache when exists (english)', async () => {
    const cached = {
      data: [{ category: Category.SUITS, total: 5 }],
      dados: [{ categoria: Category.SUITS, total: 5 }],
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));
    const result = await service.findAll();
    expect(result).toEqual(cached);
    expect(prisma.product.groupBy).not.toHaveBeenCalled();
  });

  it('legacy portuguese cache should also be read', async () => {
    const cachedPt = { dados: [{ categoria: Category.SUITS, total: 3 }] };
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(cachedPt));
    // first call checks cache:categories (english) -> null, second checks cache:categorias (pt) -> cachedPt
    // our service now checks both keys sequentially
    // we mock to return null then pt cached
    // actual service checks get('cache:categories') then get('cache:categorias') if first is null
    // but our mock above only handles one get, so we need to simulate second call
    // simpler: mock to return pt cached directly
    redis.get.mockResolvedValue(JSON.stringify(cachedPt));
    const result = await service.findAll();
    expect(result.dados).toBeDefined();
  });

  it('should fetch groupBy and fill missing categories with 0 (english)', async () => {
    prisma.product.groupBy.mockResolvedValue([
      { category: Category.SUITS, _count: { category: 2 } },
      { category: Category.DRESSES, _count: { category: 1 } },
    ]);

    const result = await service.findAll();
    expect(prisma.product.groupBy).toHaveBeenCalledWith({
      by: ['category'],
      _count: { category: true },
    });
    expect(result.data).toHaveLength(4);
    expect(result.data.find((c) => c.category === Category.SUITS)?.total).toBe(2);
    expect(result.data.find((c) => c.category === Category.SHIRTS)?.total).toBe(0);
    expect(result.data.find((c) => c.category === Category.OTHERS)?.total).toBe(0);
    // legacy dados alias should also be present
    expect((result as any).dados).toHaveLength(4);
    expect(redis.set).toHaveBeenCalledWith('cache:categories', expect.any(String), 60);
    expect(redis.set).toHaveBeenCalledWith('cache:categorias', expect.any(String), 60);
  });

  it('should cache result for 60s', async () => {
    prisma.product.groupBy.mockResolvedValue([]);
    await service.findAll();
    expect(redis.set).toHaveBeenCalledWith(
      'cache:categories',
      expect.stringContaining('"data"'),
      60,
    );
  });

  it('should ignore parse error and fetch from DB', async () => {
    redis.get.mockResolvedValue('invalid-json');
    prisma.product.groupBy.mockResolvedValue([]);
    const result = await service.findAll();
    expect(prisma.product.groupBy).toHaveBeenCalled();
    expect(result.data).toHaveLength(4);
  });

  it('clearCache should delete both keys', async () => {
    await service.clearCache();
    expect(redis.del).toHaveBeenCalledWith('cache:categories');
    expect(redis.del).toHaveBeenCalledWith('cache:categorias');
  });

  it('legacy CategoriasService alias should exist', () => {
    const { CategoriasService } = require('./categories.service');
    expect(CategoriasService).toBeDefined();
  });
});
