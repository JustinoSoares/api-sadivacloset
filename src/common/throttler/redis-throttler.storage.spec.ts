import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('deve incrementar contador e definir TTL via Lua', async () => {
    const evalMock = jest.fn().mockResolvedValue([3, 55000]);
    const redis = { eval: evalMock, incr: jest.fn(), pttl: jest.fn(), pexpire: jest.fn() } as any;
    const storage = new RedisThrottlerStorage(redis);

    const result = await storage.increment('key-test', 60000);
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      1,
      'throttler:key-test',
      '60000',
    );
    expect(result).toEqual({ totalHits: 3, timeToExpire: 55000 });
  });

  it('deve usar fallback quando eval falha', async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error('eval fail')),
      incr: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(-1),
      pexpire: jest.fn().mockResolvedValue(1),
    } as any;
    const storage = new RedisThrottlerStorage(redis);
    const result = await storage.increment('k', 60000);
    expect(redis.incr).toHaveBeenCalledWith('throttler:k');
    expect(redis.pexpire).toHaveBeenCalledWith('throttler:k', 60000);
    expect(result).toEqual({ totalHits: 1, timeToExpire: 60000 });
  });

  it('deve retornar timeToExpire do pttl quando já existe', async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error('fail')),
      incr: jest.fn().mockResolvedValue(5),
      pttl: jest.fn().mockResolvedValue(30000),
      pexpire: jest.fn(),
    } as any;
    const storage = new RedisThrottlerStorage(redis);
    const result = await storage.increment('k2', 60000);
    expect(result).toEqual({ totalHits: 5, timeToExpire: 30000 });
    expect(redis.pexpire).not.toHaveBeenCalled();
  });
});
