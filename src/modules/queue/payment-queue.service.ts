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

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.queueName = this.config.get<string>('queue.paymentConfirmed') || 'pagamento-confirmado';
    try {
      // BullMQ pode reutilizar o mesmo Redis (necessita maxRetriesPerRequest: null – já configurado em RedisModule)
      this.queue = new Queue(this.queueName, { connection: this.redis as any });
      this.logger.log(`Fila BullMQ dedicada criada: ${this.queueName}`);
      // evitar warning de lidar com eventos não tratados
      this.queue.on('error', (err) =>
        this.logger.error(`Queue ${this.queueName} erro: ${err.message}`),
      );
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
