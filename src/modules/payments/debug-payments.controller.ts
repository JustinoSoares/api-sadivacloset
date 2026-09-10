import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('payments-debug')
@ApiBearerAuth('bearer')
@Controller()
export class DebugPaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  // BUYER: GET /orders/:id/payment/debug  e  GET /payments/:orderId/debug
  @Get('orders/:id/payment/debug')
  @ApiOperation({ summary: 'Debug pagamento do pedido (buyer)', description: 'Retorna pagamento, pedido, providerDetails, webhookProcessedAt, walletTransactions, auditLogs e diagnostico do fluxo Honor->Sadiva.' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Order/Payment not found or not owned' })
  async debugBuyer(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payment: true, delivery: true, items: true } });
    if (!order || order.buyerId !== user.sub) return { error: { code: 'NOT_FOUND', message: 'Order not found' } } as any;
    return this.buildDebug(order.payment, order);
  }

  @Get('payments/:orderId/debug')
  @ApiOperation({ summary: 'Debug pagamento por orderId (buyer alias)' })
  @ApiParam({ name: 'orderId', type: 'string', format: 'uuid' })
  async debugBuyerAlias(@CurrentUser() user: JwtPayload, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.debugBuyer(user, orderId);
  }

  // ADMIN: GET /admin/payments/:paymentId/debug
  @Get('admin/payments/:paymentId/debug')
  @Roles('admin')
  @ApiOperation({ summary: 'Debug pagamento admin por paymentId', description: 'Admin vê tudo + dicas de falha webhook/websocket' })
  @ApiParam({ name: 'paymentId', type: 'string', format: 'uuid' })
  async debugAdmin(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return { error: { code: 'NOT_FOUND', message: 'Payment not found' } } as any;
    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId }, include: { payment: true, delivery: true, items: true } });
    return this.buildDebug(payment, order, true);
  }

  private async buildDebug(payment: any, order: any, isAdmin = false) {
    if (!payment) {
      return {
        data: { order },
        debug: {
          hasPayment: false,
          hint: 'Pagamento não iniciado. Chame POST /orders/:id/payment/init com method=gpo|gpr|BANK_TRANSFER',
          nextStep: 'POST /orders/:id/payment/init',
        },
      };
    }

    const walletTx = await this.prisma.walletTransaction.findMany({ where: { paymentId: payment.id }, orderBy: { createdAt: 'desc' } });
    const auditLogs = await this.prisma.auditLog.findMany({ where: { entity: 'payment', entityId: payment.id }, orderBy: { createdAt: 'desc' }, take: 10 }).catch(() => []);
    // também tenta auditoria honor-style entity=payment
    const auditLogs2 = await this.prisma.auditLog.findMany({ where: { entityId: payment.id }, orderBy: { createdAt: 'desc' }, take: 10 }).catch(() => []);
    const audits = [...auditLogs, ...auditLogs2].slice(0, 10);

    // Redis idempotency checks
    const refs = [payment.externalReference, payment.bridpayMerchantTxId, payment.providerTxId, payment.id].filter(Boolean) as string[];
    const redisKeys: Record<string, boolean | string> = {};
    for (const ref of refs.slice(0, 3)) {
      for (const g of ['generic', 'appypay', 'gpo', 'gpr']) {
        const k = `webhook:payment:${g}:${ref}`;
        try { redisKeys[k] = await this.redis.exists(k) ? 'SET (idempotent)' : 'NOT_SET'; } catch { redisKeys[k] = 'redis_error'; }
      }
      const k2 = `webhook:payment:appypay:${ref}`;
      try { redisKeys[k2] = await this.redis.exists(k2) ? 'SET' : 'NOT_SET'; } catch {}
    }

    // Config check (sem expor secrets)
    const sadivaSecret = this.config.get<string>('webhook.paymentSecret') ?? this.config.get<string>('PAYMENT_WEBHOOK_SECRET') ?? '';
    const honorSadivaSecret = process.env.PAYMENT_WEBHOOK_SECRET_SADIVA ?? process.env.SADIVA_PROXY_URL ?? '';
    const appypayWebhookSecret = this.config.get<string>('appypay.webhookSecret') ?? this.config.get<string>('APPYPAY_WEBHOOK_SECRET') ?? '';

    const hints: string[] = [];
    const webhookOk = !!payment.webhookProcessedAt || payment.status === 'PAID';
    if (payment.status === 'PROCESSING' && !payment.webhookProcessedAt) hints.push('Pagamento em PROCESSING aguardando webhook. Verifique se Honor está proxyando para SADIVA_PROXY_URL e se x-signature=HMAC(rawBody, PAYMENT_WEBHOOK_SECRET_SADIVA) está correto.');
    if (payment.status === 'PENDING' && payment.method === 'BANK_TRANSFER') hints.push('BANK_TRANSFER fica PENDING até comprovativo + PATCH /admin/payments/:id/validar ou webhook generic {"externalReference": "...","status":"paid"}');
    if (payment.status === 'PENDING' && hints.length === 0) hints.push('Ainda não processado. Tente webhook POST /webhooks/appypay {"merchantTransactionId":"'+payment.externalReference+'","operationStatus":1}');
    if (!sadivaSecret) hints.push('PAYMENT_WEBHOOK_SECRET não configurado em Sadiva - webhook aceita sem HMAC (dev only) mas Honor pode estar enviando HMAC e falhando.');
    if (payment.providerDetails && (payment.providerDetails as any).error) hints.push('providerDetails.error: '+(payment.providerDetails as any).error+' - AppyPay auth/charge falhou, mas fallback local criou PROCESSING. Use webhook para confirmar.');
    if (payment.status === 'PAID' && order?.status !== 'PAID') hints.push('Inconsistência: payment PAID mas order '+order.status+' - webhook marcou payment mas não order (verifique handleAppyPayWebhook).');
    if (payment.status === 'PAID') hints.push('Pagamento PAID - websocket deve ter emitido payment:confirmed para buyer:'+order.buyerId+' na namespace /realtime. Conecte socket.io com token JWT e ouça evento payment:confirmed.');

    // Honor proxy check
    const honorProxyUrl = process.env.SADIVA_PROXY_URL ?? 'https://api-sadivacloset.himersus.com/api/v1/webhooks/payment/generic';

    return {
      data: {
        payment: {
          id: payment.id,
          orderId: payment.orderId,
          method: payment.method,
          amount: payment.amount,
          status: payment.status,
          externalReference: payment.externalReference,
          providerTxId: payment.providerTxId,
          bridpayMerchantTxId: payment.bridpayMerchantTxId,
          receiptUrl: payment.receiptUrl,
          providerDetails: payment.providerDetails,
          webhookProcessedAt: payment.webhookProcessedAt,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        },
        order: order ? { id: order.id, buyerId: order.buyerId, status: order.status, total: order.total, subtotal: order.subtotal, deliveryFee: order.deliveryFee, delivery: order.delivery, items: order.items } : null,
        walletTransactions: walletTx,
        auditLogs: audits,
        redis: redisKeys,
        config: isAdmin ? {
          hasSadivaWebhookSecret: !!sadivaSecret,
          hasAppypayWebhookSecret: !!appypayWebhookSecret,
          honorProxyUrl,
          hasHonorSadivaSecretEnv: !!honorSadivaSecret,
          websocket: { namespace: '/realtime', events: ['payment:confirmed','payment:failed','connected','joined'], auth: 'socket.handshake.auth.token = Bearer <access_token> ou socket.emit(\"auth:join\",{token})' },
        } : { websocket: { namespace: '/realtime', event: 'payment:confirmed' } },
        hints,
      },
    };
  }
}
