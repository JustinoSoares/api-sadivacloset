import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EkwanzaClient } from './providers/ekwanza.client';
import { AppyPayClient } from './providers/appypay.client';
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
import { DebugPaymentsController } from './debug-payments.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [StorageModule, NotificationsModule, QueueModule, RealtimeModule],
  controllers: [
    PagamentosController,
    OrdersPaymentController,
    PagamentosHistoricoController,
    WalletController,
    AdminPagamentosController,
    AdminPaymentsController,
    WebhooksController,
    DebugPaymentsController,
  ],
  providers: [PaymentsService, EkwanzaClient, AppyPayClient],
  exports: [PaymentsService, EkwanzaClient, AppyPayClient],
})
export class PaymentsModule {}
