import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryZonesService, ZonasEntregaService } from './delivery-zones.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('DeliveryZonesService', () => {
  let service: DeliveryZonesService;
  let prisma: { deliveryZone: { findMany: jest.Mock } };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  const zonesMock = [
    { id: '1', neighborhood: 'Talatona', price: 2500 },
    { id: '2', neighborhood: 'Kilamba', price: 3000 },
    { id: '3', neighborhood: 'Viana', price: 2500 },
  ];

  beforeEach(async () => {
    prisma = { deliveryZone: { findMany: jest.fn().mockResolvedValue(zonesMock) } };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryZonesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<DeliveryZonesService>(DeliveryZonesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return from cache when exists (english)', async () => {
    const cached = {
      data: [{ id: '1', neighborhood: 'Talatona', bairro: 'Talatona', price: 2500, preco: 2500 }],
      dados: [{ id: '1', neighborhood: 'Talatona', bairro: 'Talatona', price: 2500, preco: 2500 }],
    };
    redis.get.mockResolvedValue(JSON.stringify(cached));
    const result = await service.findAll();
    expect(result).toEqual(cached);
    expect(prisma.deliveryZone.findMany).not.toHaveBeenCalled();
  });

  it('should fetch from DB ordered by neighborhood and cache 60s', async () => {
    const result = await service.findAll();
    expect(prisma.deliveryZone.findMany).toHaveBeenCalledWith({ orderBy: { neighborhood: 'asc' } });
    expect(result.data).toHaveLength(3);
    expect(result.dados).toHaveLength(3);
    // bilingual shape
    expect(result.data[0]).toEqual({
      id: '1',
      neighborhood: 'Talatona',
      bairro: 'Talatona',
      price: 2500,
      preco: 2500,
    });
    expect(result.dados[0]).toEqual({
      id: '1',
      neighborhood: 'Talatona',
      bairro: 'Talatona',
      price: 2500,
      preco: 2500,
    });
    expect(redis.set).toHaveBeenCalledWith('cache:delivery-zones', expect.any(String), 60);
    expect(redis.set).toHaveBeenCalledWith('cache:zonas-entrega', expect.any(String), 60);
  });

  it('should ignore parse error and fetch from DB', async () => {
    redis.get.mockResolvedValue('invalid-json');
    const result = await service.findAll();
    expect(prisma.deliveryZone.findMany).toHaveBeenCalled();
    expect(result.data).toHaveLength(3);
  });

  it('should support legacy plain array cache', async () => {
    const arr = [
      { id: '1', neighborhood: 'Talatona', bairro: 'Talatona', price: 2500, preco: 2500 },
    ];
    redis.get.mockResolvedValue(JSON.stringify(arr));
    const result = await service.findAll();
    expect(result.data).toEqual(arr);
    expect(result.dados).toEqual(arr);
  });

  it('clearCache should delete both keys', async () => {
    await service.clearCache();
    expect(redis.del).toHaveBeenCalledWith('cache:delivery-zones');
    expect(redis.del).toHaveBeenCalledWith('cache:zonas-entrega');
  });

  it('legacy ZonasEntregaService alias should exist', () => {
    expect(ZonasEntregaService).toBeDefined();
    expect(ZonasEntregaService).toBe(DeliveryZonesService);
  });
});
