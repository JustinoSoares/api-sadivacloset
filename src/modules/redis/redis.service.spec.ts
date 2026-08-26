import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let redisMock: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    keys: jest.Mock;
  };

  beforeEach(async () => {
    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn(),
      keys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService, { provide: 'REDIS_CLIENT', useValue: redisMock }],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('set com TTL deve chamar set com EX', async () => {
    await service.set('k', 'v', 60);
    expect(redisMock.set).toHaveBeenCalledWith('k', 'v', 'EX', 60);
  });

  it('set sem TTL deve chamar set simples', async () => {
    await service.set('k', 'v');
    expect(redisMock.set).toHaveBeenCalledWith('k', 'v');
  });

  it('get deve delegar', async () => {
    redisMock.get.mockResolvedValue('val');
    await expect(service.get('k')).resolves.toBe('val');
  });

  it('exists deve retornar boolean', async () => {
    redisMock.exists.mockResolvedValue(1);
    await expect(service.exists('k')).resolves.toBe(true);
    redisMock.exists.mockResolvedValue(0);
    await expect(service.exists('k')).resolves.toBe(false);
  });

  it('delByPattern deve usar keys + del', async () => {
    redisMock.keys.mockResolvedValue(['cache:a', 'cache:b']);
    await service.delByPattern('cache:*');
    expect(redisMock.keys).toHaveBeenCalledWith('cache:*');
    expect(redisMock.del).toHaveBeenCalledWith('cache:a', 'cache:b');
  });

  it('delByPattern deve retornar 0 quando nenhuma chave', async () => {
    redisMock.keys.mockResolvedValue([]);
    await expect(service.delByPattern('cache:nenhuma:*')).resolves.toBe(0);
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
