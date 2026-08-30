import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url') ?? config.get<string>('REDIS_URL');
        // Log sanitizado (sem password) para debug na VPS
        const sanitized = (() => {
          try {
            const u = new URL(url as string);
            return `${u.protocol}//${u.hostname}:${u.port || '6379'}`;
          } catch {
            return url as string;
          }
        })();
        console.log(`[Redis] a ligar em ${sanitized} ...`);
        const client = new Redis(url as string, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
          enableOfflineQueue: false,
          // ioredis v5: retryStrategy recebe (times) -> number | null (null = stop retrying)
          retryStrategy: (times: number) => {
            // backoff exponencial limitado a 5s, max 20 tentativas antes de parar spam
            if (times > 20) {
              console.error(
                `[Redis] ${times} tentativas falhadas para ${sanitized} — a parar retries (verifique REDIS_URL e se container redis está up)`,
              );
              return null;
            }
            const delay = Math.min(times * 200, 5000);
            return delay;
          },
          reconnectOnError: (err) => {
            // READONLY etc. devem reconectar; outros erros deixam retryStrategy decidir
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) return true;
            return false;
          },
        });
        client.on('connect', () => console.log(`✅ Redis ligado (${sanitized})`));
        client.on('ready', () => console.log(`✅ Redis pronto (${sanitized})`));
        client.on('close', () => console.warn(`⚠️ Redis ligação fechada (${sanitized})`));
        client.on('reconnecting', () => console.log(`🔄 Redis a reconectar (${sanitized})...`));
        client.on('error', (err) =>
          console.error(
            `❌ Redis erro (${sanitized}):`,
            err.message,
            // @ts-ignore
            err.code ? `code=${err.code}` : '',
          ),
        );
        return client;
      },
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
