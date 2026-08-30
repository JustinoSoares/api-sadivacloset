import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EkwanzaClient } from './providers/ekwanza.client';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import {
  PagamentosController,
  OrdersPaymentController,
  PagamentosHistoricoController,
  WalletController,
} from './payments.controller';
import { AdminPagamentosController, AdminPaymentsController } from './admin-payments.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [StorageModule, NotificationsModule, QueueModule],
  controllers: [
    PagamentosController,
    OrdersPaymentController,
    PagamentosHistoricoController,
    WalletController,
    AdminPagamentosController,
    AdminPaymentsController,
    WebhooksController,
  ],
  providers: [PaymentsService, EkwanzaClient],
  exports: [PaymentsService, EkwanzaClient],
})
export class PaymentsModule {}
