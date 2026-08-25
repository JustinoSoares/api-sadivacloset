import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  /**
   * Incrementa contador para a key com TTL em ms.
   * Usa INCR + PTTL + PEXPIRE de forma o mais atómica possível.
   * Para throttler v5 a assinatura é (key, ttl) onde ttl já é em ms.
   */
  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttler:${key}`;

    // Lua script para atomicidade: INCR, pegar PTTL, se for -1 (sem expire) setar PEXPIRE
    // Retorna [totalHits, timeToExpire]
    const lua = `
      local total = redis.call('INCR', KEYS[1])
      local pttl = redis.call('PTTL', KEYS[1])
      if pttl == -1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
        pttl = tonumber(ARGV[1])
      end
      return { total, pttl }
    `;

    try {
      const result = (await this.redis.eval(lua, 1, redisKey, String(ttl))) as [number, number];
      const totalHits = Number(result[0]);
      const timeToExpire = Number(result[1]);
      // pttl pode ser -2 se key não existe? INCR garante existência, então -1 tratado
      return {
        totalHits,
        timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
      };
    } catch {
      // Fallback não-atómico (não deve acontecer)
      const totalHits = await this.redis.incr(redisKey);
      const pttl = await this.redis.pttl(redisKey);
      if (pttl === -1) {
        await this.redis.pexpire(redisKey, ttl);
        return { totalHits, timeToExpire: ttl };
      }
      return { totalHits, timeToExpire: pttl > 0 ? pttl : ttl };
    }
  }
}
