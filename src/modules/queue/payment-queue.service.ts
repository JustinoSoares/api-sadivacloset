import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';

@Injectable()
export class PaymentQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentQueueService.name);
  private queue: Queue | null = null;
  private queueName: string;

  // Throttle de logs para não spammar a cada 2s quando Redis está down
  private lastErrorLogAt = 0;
  private errorCount = 0;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.queueName = this.config.get<string>('queue.paymentConfirmed') || 'pagamento-confirmado';
    try {
      // BullMQ pode reutilizar o mesmo Redis (necessita maxRetriesPerRequest: null – já configurado em RedisModule)
      this.queue = new Queue(this.queueName, { connection: this.redis as any });
      this.logger.log(`Fila BullMQ dedicada criada: ${this.queueName}`);
      // Throttle: loga no máximo 1 vez a cada 30s para não poluir logs na VPS quando Redis está down
      this.queue.on('error', (err) => {
        this.errorCount++;
        const now = Date.now();
        if (now - this.lastErrorLogAt > 30_000) {
          this.lastErrorLogAt = now;
          this.logger.error(
            `Queue ${this.queueName} erro: ${err.message} (${this.errorCount} erros desde o boot, verificado REDIS_URL e container redis)`,
          );
        }
      });
      // Opcional: log quando queue recupera
      // BullMQ Queue não tem evento 'ready', mas podemos observar redis
      (this.redis as any).on?.('ready', () => {
        if (this.errorCount > 0) {
          this.logger.log(`Queue ${this.queueName} — Redis recuperado após ${this.errorCount} erros`);
          this.errorCount = 0;
        }
      });
    } catch (e: any) {
      this.logger.warn(
        `Falha ao criar fila BullMQ ${this.queueName}: ${e.message} – fallback para log apenas`,
      );
      this.queue = null;
    }
  }

  async enqueuePaymentConfirmed(payload: {
    paymentId: string;
    orderId: string;
    buyerId: string;
    gateway: string;
    referenciaExterna: string;
    amount: number;
    confirmedAt: string;
  }): Promise<void> {
    if (!this.queue) {
      this.logger.log(
        `[MOCK QUEUE ${this.queueName}] pagamento-confirmado: ${JSON.stringify(payload)}`,
      );
      return;
    }
    try {
      await this.queue.add('pagamento.confirmado', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
      this.logger.log(
        `Evento enfileirado ${this.queueName} -> pagamento ${payload.paymentId} gateway ${payload.gateway}`,
      );
    } catch (e: any) {
      this.logger.error(`Falha ao enfileirar pagamento-confirmado: ${e.message}`);
      // não propaga – webhook já confirmou pagamento, fila é best-effort
    }
  }

  async onModuleDestroy() {
    if (this.queue) {
      try {
        await this.queue.close();
      } catch {}
    }
  }
}
