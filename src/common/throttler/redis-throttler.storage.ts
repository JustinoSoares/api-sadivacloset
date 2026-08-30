import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import type Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  // Fallback in-memory quando Redis está down (VPS) — evita 500 em /auth
  private readonly memoryFallback = new Map<string, { hits: number; expiresAt: number }>();
  private redisDownWarned = false;

  constructor(private readonly redis: Redis) {}

  /**
   * Incrementa contador para a key com TTL em ms.
   * Usa INCR + PTTL + PEXPIRE de forma o mais atómica possível.
   * Para throttler v5 a assinatura é (key, ttl) onde ttl já é em ms.
   * Se Redis estiver down, faz fallback in-memory para não quebrar a API.
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
      if (this.redisDownWarned) {
        this.logger.log('Redis recuperado — throttler voltou a usar Redis');
        this.redisDownWarned = false;
      }
      // pttl pode ser -2 se key não existe? INCR garante existência, então -1 tratado
      return {
        totalHits,
        timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
      };
    } catch {
      try {
        // Fallback não-atómico
        const totalHits = await this.redis.incr(redisKey);
        const pttl = await this.redis.pttl(redisKey);
        if (pttl === -1) {
          await this.redis.pexpire(redisKey, ttl);
          return { totalHits, timeToExpire: ttl };
        }
        return { totalHits, timeToExpire: pttl > 0 ? pttl : ttl };
      } catch (e: any) {
        // Redis totalmente down — fallback in-memory (best-effort, por instância)
        if (!this.redisDownWarned) {
          this.logger.warn(
            `Redis throttler fallback in-memory (Redis down: ${e.message}) — rate limiting por instância apenas`,
          );
          this.redisDownWarned = true;
        }
        const now = Date.now();
        const existing = this.memoryFallback.get(redisKey);
        if (!existing || now > existing.expiresAt) {
          const rec = { hits: 1, expiresAt: now + ttl };
          this.memoryFallback.set(redisKey, rec);
          return { totalHits: 1, timeToExpire: ttl };
        }
        existing.hits++;
        return { totalHits: existing.hits, timeToExpire: existing.expiresAt - now };
      }
    }
  }
}
