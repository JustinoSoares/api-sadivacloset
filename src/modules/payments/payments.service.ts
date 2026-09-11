import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EkwanzaClient } from './providers/ekwanza.client';
import { AppyPayClient } from './providers/appypay.client';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { PaymentQueueService } from '../queue/payment-queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailService } from '../mail/mail.service';

function mapMetodoToEnum(metodo: string): PaymentMethod {
  const n = metodo.toLowerCase().trim();
  const map: Record<string, PaymentMethod> = {
    multicaixa_express: PaymentMethod.MULTICAIXA_EXPRESS,
    gpo: PaymentMethod.MULTICAIXA_EXPRESS,
    'multicaixa express': PaymentMethod.MULTICAIXA_EXPRESS,
    referencia_multicaixa: PaymentMethod.MULTICAIXA_REFERENCE,
    referencia: PaymentMethod.MULTICAIXA_REFERENCE,
    gpr: PaymentMethod.MULTICAIXA_REFERENCE,
    reference: PaymentMethod.MULTICAIXA_REFERENCE,
    transferencia: PaymentMethod.BANK_TRANSFER,
    bank_transfer: PaymentMethod.BANK_TRANSFER,
    transferencia_bancaria: PaymentMethod.BANK_TRANSFER,
    pagamento_entrega: PaymentMethod.CASH_ON_DELIVERY,
    cash_on_delivery: PaymentMethod.CASH_ON_DELIVERY,
    na_entrega: PaymentMethod.CASH_ON_DELIVERY,
    cartao: PaymentMethod.CARD,
    card: PaymentMethod.CARD,
    kwik: PaymentMethod.BANK_TRANSFER, // kwik usa transferência bancária como método local
  };
  const e = map[n];
  if (!e)
    throw new BadRequestException({
      error: {
        code: 'INVALID_PAYMENT_METHOD',
        message: `Method '${metodo}' is invalid. Use: multicaixa_express (gpo), referencia_multicaixa (gpr), transferencia, pagamento_entrega, cartao`,
      },
    });
  return e;
}

function isGatewayMethod(method: PaymentMethod): boolean {
  return (
    method === PaymentMethod.MULTICAIXA_EXPRESS || method === PaymentMethod.MULTICAIXA_REFERENCE
  );
}

function toPaymentResponse(payment: any) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method,
    amount: payment.amount,
    status: payment.status,
    externalReference: payment.externalReference ?? null,
    receiptUrl: payment.receiptUrl ?? null,
    providerTxId: payment.providerTxId ?? null,
    bridpayIntentId: payment.bridpayIntentId ?? null,
    bridpayMerchantTxId: payment.bridpayMerchantTxId ?? null,
    providerDetails: payment.providerDetails ?? null,
    phoneNumber: payment.phoneNumber ?? null,
    iban: payment.iban ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ekwanza: EkwanzaClient,
    private readonly appypay: AppyPayClient,
    private readonly storage: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly paymentQueue: PaymentQueueService,
    private readonly realtime: RealtimeGateway,
    private readonly mail: MailService,
  ) {}

  private generateMerchantTxId(): string {
    // 15 chars como BridPay – hash do UUID
    const uuid = randomUUID();
    const hash = createHash('sha256').update(uuid).digest();
    let bigint = 0n;
    for (const b of hash) bigint = (bigint << 8n) | BigInt(b);
    return bigint.toString(36).slice(0, 15).padStart(15, '0');
  }

  private deriveMerchantTransactionId(merchantTxId: string): string {
    const hash = createHash('sha256').update(merchantTxId).digest();
    let bigint = 0n;
    for (const b of hash) bigint = (bigint << 8n) | BigInt(b);
    return bigint.toString(36).slice(0, 15);
  }

  private async notifyWebhookEmail(params: {
    gateway: string;
    rawBody: string;
    headers: Record<string, string>;
    payload: any;
    payment?: any;
    order?: any;
    result?: any;
    error?: string;
  }) {
    try {
      await this.mail.sendWebhookNotification({
        to: 'justinocsoares123@gmail.com',
        gateway: params.gateway,
        rawBody: params.rawBody,
        headers: params.headers,
        payload: params.payload,
        payment: params.payment,
        order: params.order,
        result: params.result,
        error: params.error,
      });
    } catch (e) {
      this.logger.warn(`Webhook email falhou: ${(e as Error).message}`);
    }
  }

  async iniciar(
    buyerId: string,
    orderId: string,
    dto: {
      metodo: string;
      phoneNumber?: string;
      iban?: string;
      descricao?: string;
      expiresInSeconds?: number;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        error: { code: 'ORDER_CANCELLED', message: 'Cancelled order cannot be paid' },
      });
    }
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        error: { code: 'ORDER_ALREADY_PAID', message: 'Order already paid' },
      });
    }
    if (order.payment && order.payment.status === PaymentStatus.PAID) {
      throw new BadRequestException({
        error: { code: 'PAYMENT_ALREADY_VALIDATED', message: 'Payment already validated' },
      });
    }

    const method = mapMetodoToEnum(dto.metodo);
    // validate method-specific fields
    if (method === PaymentMethod.MULTICAIXA_EXPRESS) {
      if (!dto.phoneNumber) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'phoneNumber is required for multicaixa_express (gpo)',
            details: [{ field: 'phoneNumber', errors: ['required for GPO'] }],
          },
        });
      }
    }
    if (dto.iban && method !== PaymentMethod.BANK_TRANSFER) {
      // iban só faz sentido para transferência/kwik; mas aceita
    }

    // Se já existe pagamento pendente/processando, retorna ele (idempotente) ou atualiza método
    let existing = order.payment;
    // Se existe e método diferente, permite trocar se ainda não pago
    if (existing && existing.status !== PaymentStatus.PAID && existing.method !== method) {
      existing = await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          method,
          amount: order.total,
          phoneNumber: dto.phoneNumber ?? null,
          iban: dto.iban ?? null,
        },
      });
    }

    const amount = order.total;

    // Criar ou recuperar pagamento
    let payment = existing;
    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId,
          method,
          amount,
          status: isGatewayMethod(method) ? PaymentStatus.PROCESSING : PaymentStatus.PENDING,
          phoneNumber: dto.phoneNumber ?? null,
          iban: dto.iban ?? null,
        },
      });

      // ledger entrada pendente
      await this.prisma.walletTransaction.create({
        data: {
          type: 'credit',
          amount,
          balanceBefore: 0,
          balanceAfter: 0,
          status: 'pending',
          referenceType: 'payment_intent',
          referenceId: payment.id,
          description: `Pagamento iniciado ${method} pedido ${orderId}`,
          orderId,
          paymentId: payment.id,
        },
      });
    } else if (payment.amount !== amount) {
      // atualiza valor se total mudou
      payment = await this.prisma.payment.update({ where: { id: payment.id }, data: { amount } });
    }

    // Gateway GPO/GPR — AppyPay integrado (NÃO BLOQUEANTE para evitar timeout GPO)
    if (isGatewayMethod(method)) {
      const merchantTxId = this.generateMerchantTxId();
      const methodLabel = method === PaymentMethod.MULTICAIXA_EXPRESS ? 'gpo' : 'gpr';
      const isGpo = method === PaymentMethod.MULTICAIXA_EXPRESS;
      const description = dto.descricao ?? `Pedido ${orderId.slice(0, 8)} - ${methodLabel.toUpperCase()}`;

      if (isGpo && !dto.phoneNumber) {
        throw new BadRequestException({
          error: { code: 'VALIDATION_ERROR', message: 'phoneNumber é obrigatório para GPO (Multicaixa Express)' },
        });
      }

      // Resposta imediata ao usuário — não espera AppyPay (AppyPay pode prender request até usuário aprovar no telemóvel)
      const pendingProviderTxId = this.deriveMerchantTransactionId(merchantTxId);
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PROCESSING,
          externalReference: merchantTxId,
          providerTxId: pendingProviderTxId,
          bridpayMerchantTxId: merchantTxId,
          providerDetails: {
            provider: this.appypay.isConfigured() ? 'appypay' : 'local',
            method: methodLabel,
            merchantTxId,
            providerTxId: pendingProviderTxId,
            pending: true,
            amount,
            phoneNumber: isGpo ? dto.phoneNumber : undefined,
            ...(this.appypay.isConfigured() ? {} : { mock: true, hint: 'Configure APPYPAY_* no .env para AppyPay real' }),
          } as any,
        },
      });
      this.logger.log(`Pagamento ${methodLabel.toUpperCase()} iniciado mTxId=${merchantTxId} - resposta imediata PROCESSING, AppyPay em background`);

      // Background: chama AppyPay sem bloquear resposta ao usuário (evita timeout)
      if (this.appypay.isConfigured()) {
        // fire-and-forget
        setImmediate(async () => {
          try {
            this.logger.log(`[BG] AppyPay ${methodLabel.toUpperCase()} iniciando mTxId=${merchantTxId}`);
            let appypayRes: any;
            // Timeout de 8s para não ficar preso para sempre — se demorar, deixa como pending e webhook confirmará
            const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
              Promise.race([
                p,
                new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`AppyPay timeout ${ms}ms`)), ms)),
              ]);
            if (isGpo) {
              appypayRes = await withTimeout(
                this.appypay.createGpoCharge({
                  amount,
                  merchantTransactionId: merchantTxId,
                  phoneNumber: dto.phoneNumber!,
                  description,
                }),
                8000,
              );
            } else {
              appypayRes = await withTimeout(
                this.appypay.createReferenceCharge({
                  amount,
                  merchantTransactionId: merchantTxId,
                  description,
                }),
                8000,
              );
            }

            const providerTxId =
              appypayRes.providerTransactionId ??
              appypayRes.transactionId ??
              appypayRes.id ??
              appypayRes.reference ??
              this.deriveMerchantTransactionId(merchantTxId);
            const entity = appypayRes.entity ?? appypayRes.Entity ?? this.config.get<string>('appypay.codeRef') ?? this.config.get<string>('APPYPAY_CODE_REF') ?? '10111';
            const reference = appypayRes.reference ?? appypayRes.Reference ?? appypayRes.code ?? null;
            const expirationDate = appypayRes.expirationDate ?? appypayRes.ExpirationDate ?? null;

            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                providerTxId: String(providerTxId),
                providerDetails: {
                  provider: 'appypay',
                  method: methodLabel,
                  merchantTxId,
                  providerTxId: String(providerTxId),
                  entity: isGpo ? undefined : entity,
                  reference: isGpo ? undefined : reference,
                  expirationDate: expirationDate ?? undefined,
                  amount,
                  phoneNumber: isGpo ? dto.phoneNumber : undefined,
                  rawResponse: appypayRes,
                } as any,
              },
            });
            this.logger.log(`[BG] AppyPay ${methodLabel.toUpperCase()} sucesso mTxId=${merchantTxId} providerTxId=${providerTxId} ${isGpo ? '' : `ref=${reference}`}`);
          } catch (e: any) {
            // Timeout ou erro AppyPay — mantém PROCESSING com erro, pagamento será confirmado via webhook POST /webhooks/appypay quando usuário aprovar
            if (e.message?.includes('timeout')) {
              this.logger.warn(`[BG] AppyPay ${methodLabel.toUpperCase()} timeout mTxId=${merchantTxId} - mantendo pending, aguardando webhook`);
            } else {
              this.logger.error(`[BG] AppyPay ${methodLabel.toUpperCase()} falhou mTxId=${merchantTxId}: ${e.message}`);
            }
            try {
              const current = await this.prisma.payment.findUnique({ where: { id: payment.id } });
              // só atualiza se ainda PROCESSING (não foi confirmado via webhook)
              if (current && current.status === PaymentStatus.PROCESSING) {
                await this.prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    providerDetails: {
                      ...(current.providerDetails as any),
                      error: e.message,
                      bgErrorAt: new Date().toISOString(),
                    } as any,
                  },
                });
              }
            } catch {}
          }
        });
      }
    }

    // KWIK é saída (payout) via E-Kwanza direto – POST /Operations/SendKWiKToCustomer
    if (dto.iban && dto.metodo.toLowerCase() === 'kwik') {
      const merchantTxId = this.generateMerchantTxId();
      try {
        const ekwanzaConfigured =
          !!this.config.get<string>('ekwanza.apiBaseUrl') &&
          !!this.config.get<string>('ekwanza.notificationToken');
        if (ekwanzaConfigured) {
          const kwikRes = await this.ekwanza.sendKwikToCustomer({
            iban: dto.iban!,
            amount,
            operationCode: merchantTxId,
          });
          await this.prisma.payout.create({
            data: {
              amount,
              iban: dto.iban!,
              method: PaymentMethod.BANK_TRANSFER,
              status: PaymentStatus.PROCESSING,
              externalReference: merchantTxId,
              providerTxId: kwikRes.ekzTransactionCode ?? kwikRes.ekzOperationCode ?? merchantTxId,
              description: dto.descricao ?? `KWIK payout pedido ${orderId}`,
              orderId,
              paymentId: payment.id,
            },
          });
          await this.prisma.walletTransaction.create({
            data: {
              type: 'debit',
              amount,
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'pending',
              referenceType: 'payout',
              referenceId: payment.id,
              description: `Saída KWIK ${dto.iban} pedido ${orderId}`,
              orderId,
              paymentId: payment.id,
              bridpayTxId: merchantTxId,
            },
          });
          // atualiza payment com dados kwik
          payment = await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              externalReference: merchantTxId,
              providerTxId: kwikRes.ekzTransactionCode ?? merchantTxId,
              providerDetails: {
                provider: 'ekwanza',
                method: 'kwik',
                request: { iban: dto.iban, merchantTxId },
                response: kwikRes,
              } as any,
            },
          });
        } else {
          // mock local
          await this.prisma.payout.create({
            data: {
              amount,
              iban: dto.iban!,
              method: PaymentMethod.BANK_TRANSFER,
              status: PaymentStatus.PROCESSING,
              externalReference: merchantTxId,
              providerTxId: merchantTxId,
              description: dto.descricao ?? `KWIK payout pedido ${orderId} (mock)`,
              orderId,
              paymentId: payment.id,
            },
          });
          await this.prisma.walletTransaction.create({
            data: {
              type: 'debit',
              amount,
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'pending',
              referenceType: 'payout',
              referenceId: payment.id,
              description: `Saída KWIK ${dto.iban} pedido ${orderId} (mock)`,
              orderId,
              paymentId: payment.id,
              bridpayTxId: merchantTxId,
            },
          });
          payment = await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              externalReference: merchantTxId,
              providerTxId: merchantTxId,
              providerDetails: {
                provider: 'ekwanza',
                mock: true,
                method: 'kwik',
                merchantTxId,
              } as any,
            },
          });
          this.logger.warn('E-Kwanza não configurado – KWIK em modo mock');
        }
      } catch (e: any) {
        this.logger.warn(`Falha KWiK E-Kwanza: ${e.message}`);
      }
    } else if (
      method === PaymentMethod.BANK_TRANSFER &&
      dto.iban &&
      dto.metodo.toLowerCase() !== 'kwik'
    ) {
      // transferência bancária simples – não chama provider, só wallet debit mock
      const merchantTxId = this.generateMerchantTxId();
      await this.prisma.payout.create({
        data: {
          amount,
          iban: dto.iban!,
          method: PaymentMethod.BANK_TRANSFER,
          status: PaymentStatus.PENDING,
          externalReference: merchantTxId,
          description: dto.descricao ?? `Transferência pedido ${orderId}`,
          orderId,
          paymentId: payment.id,
        },
      });
    }

    return toPaymentResponse(payment);
  }

  async get(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    if (!order.payment) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Payment not found for this order' },
      });
    }
    return toPaymentResponse(order.payment);
  }

  async comprovativo(buyerId: string, orderId: string, file: Express.Multer.File) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    if (!order.payment) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Payment not initiated. Use POST /orders/:id/payment/init first',
        },
      });
    }
    if (order.payment.status === PaymentStatus.PAID) {
      throw new BadRequestException({
        error: { code: 'PAYMENT_ALREADY_VALIDATED', message: 'Payment already validated' },
      });
    }
    // Só permite comprovativo para transferência bancária (ou todos? mas spec diz transferência)
    // Vamos permitir para qualquer método que não seja gateway automático, mas avisa
    const url = await this.storage.saveComprovativo(file);
    const updated = await this.prisma.payment.update({
      where: { id: order.payment.id },
      data: { receiptUrl: url, status: PaymentStatus.PROCESSING },
    });

    // ledger update
    await this.prisma.walletTransaction.create({
      data: {
        type: 'credit',
        amount: order.payment.amount,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'pending',
        referenceType: 'payment_intent',
        referenceId: updated.id,
        description: `Comprovativo enviado pedido ${orderId}`,
        orderId,
        paymentId: updated.id,
      },
    });

    return toPaymentResponse(updated);
  }

  // Admin validar – regra crítica: só aqui ou webhook passa Pedido para pago
  async validarAdmin(adminId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Payment not found' },
      });
    }
    if (payment.status === PaymentStatus.PAID) {
      return toPaymentResponse(payment);
    }
    // Atualiza pagamento para pago
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID },
    });

    // Atualiza pedido para pago (crítico: nunca via frontend)
    const order = await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.PAID },
      include: { payment: true },
    });

    await this.auditoria.registar(adminId, 'validate_payment', 'payment', paymentId, {
      orderId: payment.orderId,
      method: payment.method,
      amount: payment.amount,
      receiptUrl: payment.receiptUrl,
    });

    // Wallet ledger settled credit
    await this.prisma.walletTransaction.create({
      data: {
        type: 'credit',
        amount: payment.amount,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'settled',
        referenceType: 'payment_intent',
        referenceId: payment.id,
        description: `Pagamento validado admin ${adminId} pedido ${payment.orderId}`,
        orderId: payment.orderId,
        paymentId: payment.id,
        bridpayTxId: payment.bridpayMerchantTxId ?? undefined,
      },
    });

    // Notifica comprador
    try {
      await this.notificationsService.criar(
        payment.order.buyerId ?? order.buyerId,
        'Pagamento validado',
        `O seu pagamento do pedido #${payment.orderId.slice(0, 8)} foi validado e o pedido está pago`,
      );
    } catch (e) {
      this.logger.warn(`Falha ao notificar buyer ${payment.order.buyerId}: ${e}`);
    }

    // WebSocket realtime
    try {
      this.realtime.emitPaymentConfirmed(order.buyerId, {
        orderId: order.id,
        paymentId: updatedPayment.id,
        amount: updatedPayment.amount,
        gateway: 'admin_validate',
        externalReference: updatedPayment.externalReference ?? undefined,
        orderStatus: order.status,
      });
    } catch (e) {
      this.logger.warn(`Realtime emit falhou: ${e}`);
    }

    return {
      payment: toPaymentResponse(updatedPayment),
      order: {
        id: order.id,
        status: order.status,
      },
    };
  }

  async handleEkwanzaWebhook(rawBody: string, headers: Record<string, string>) {
    const apiKey =
      this.config.get<string>('ekwanza.apiKey') || this.config.get<string>('EKWANZA_API_KEY');
    const registrationNumber =
      this.config.get<string>('ekwanza.merchantRegistrationNumber') ||
      this.config.get<string>('EKWANZA_MERCHANT_REGISTRATION_NUMBER');
    const token =
      this.config.get<string>('ekwanza.notificationToken') ||
      this.config.get<string>('EKWANZA_NOTIFICATION_TOKEN');
    const received =
      headers['x-signature'] ?? (headers as any)['X-Signature'] ?? headers['x-Signature'];
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      const res = { ok: false, message: 'Invalid JSON' };
      this.notifyWebhookEmail({ gateway: 'ekwanza', rawBody, headers, payload: rawBody, result: res, error: 'Invalid JSON' }).catch(() => {});
      return res;
    }
    // Valida assinatura se configurado
    if (apiKey && registrationNumber && token && received) {
      const code = payload.code ?? '';
      const operationCode = payload.operationCode ?? payload.operation_code ?? '';
      const expected = createHmac('sha256', apiKey)
        .update([code, operationCode, registrationNumber, token].join(''))
        .digest('hex');
      try {
        if (
          expected.length !== received.length ||
          !timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'))
        ) {
          this.logger.warn('E-Kwanza webhook assinatura inválida');
        }
      } catch {}
    }
    const code = payload.code;
    const operationCode = payload.operationCode ?? payload.operation_code ?? payload.referenceCode;
    const status = String(payload.status ?? '').toLowerCase();
    const isSuccess = status === 'success' || status === 'processed' || status === 'processado';
    const isFailed = !isSuccess && !!status;

    let payment: any = null;
    let payout: any = null;
    if (operationCode) {
      payment = await this.prisma.payment.findFirst({
        where: { externalReference: String(operationCode) },
      });
      if (!payment)
        payment = await this.prisma.payment.findFirst({
          where: { bridpayMerchantTxId: String(operationCode) },
        });
      if (!payment)
        payout = await this.prisma.payout.findFirst({
          where: { externalReference: String(operationCode) },
        });
    }
    if (!payment && !payout && code) {
      payment = await this.prisma.payment.findFirst({ where: { providerTxId: String(code) } });
      if (!payment)
        payout = await this.prisma.payout.findFirst({ where: { providerTxId: String(code) } });
    }
    if (!payment && !payout) {
      this.logger.warn(`E-Kwanza webhook sem payment/payout: ${rawBody}`);
      const res = { ok: false, message: 'Payment/Payout not found' };
      this.notifyWebhookEmail({ gateway: 'ekwanza', rawBody, headers, payload, result: res, error: 'Payment/Payout not found' }).catch(() => {});
      return res;
    }

    if (payment) {
      if (isSuccess) {
        if (payment.status !== PaymentStatus.PAID) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.PAID, providerDetails: payload },
          });
          await this.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.PAID },
          });
          await this.auditoria
            .registar(
              'system-ekwanza-webhook',
              'webhook_ekwanza_sucesso',
              'pagamento',
              payment.id,
              payload,
            )
            .catch(() => {});
          await this.prisma.walletTransaction.create({
            data: {
              type: 'credit',
              amount: payment.amount,
              balanceBefore: 0,
              balanceAfter: 0,
              status: 'settled',
              referenceType: 'payment_intent',
              referenceId: payment.id,
              description: `Webhook E-Kwanza sucesso ${code}`,
              orderId: payment.orderId,
              paymentId: payment.id,
            },
          });
          try {
            const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
            if (order) {
              await this.notificationsService.criar(
                order.buyerId,
                'Pagamento confirmado',
                `O pagamento do pedido #${payment.orderId.slice(0, 8)} foi confirmado via E-Kwanza`,
              );
              try {
                this.realtime.emitPaymentConfirmed(order.buyerId, {
                  orderId: payment.orderId,
                  paymentId: payment.id,
                  amount: payment.amount,
                  gateway: 'ekwanza',
                  externalReference: String(operationCode ?? code),
                  orderStatus: 'PAID',
                });
              } catch {}
            }
          } catch {}
        }
        const ekRes = { ok: true, status: 'settled' };
        this.notifyWebhookEmail({ gateway: 'ekwanza', rawBody, headers, payload, payment, result: ekRes }).catch(() => {});
        return ekRes;
      }
      if (isFailed) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, providerDetails: payload },
        });
        const ekRes2 = { ok: true, status: 'failed' };
        this.notifyWebhookEmail({ gateway: 'ekwanza', rawBody, headers, payload, payment, result: ekRes2 }).catch(() => {});
        return ekRes2;
      }
    }
    if (payout) {
      if (isSuccess) {
        await this.prisma.payout.update({
          where: { id: payout.id },
          data: { status: PaymentStatus.PAID },
        });
        await this.prisma.walletTransaction.create({
          data: {
            type: 'debit',
            amount: payout.amount,
            balanceBefore: 0,
            balanceAfter: 0,
            status: 'settled',
            referenceType: 'payout',
            referenceId: payout.id,
            description: `Webhook E-Kwanza KWiK sucesso ${code}`,
            orderId: payout.orderId ?? undefined,
            bridpayTxId: operationCode,
          },
        });
        return { ok: true, status: 'settled' };
      }
      if (isFailed) {
        await this.prisma.payout.update({
          where: { id: payout.id },
          data: { status: PaymentStatus.FAILED },
        });
        return { ok: true, status: 'failed' };
      }
    }
    return { ok: true, status: 'pending' };
  }

  /**
   * Webhook AppyPay (GPO/GPR) — POST /webhooks/appypay
   * Payload AppyPay: { merchantTransactionId, ekwanzaTransactionId, operationStatus, operationData: { amount, merchantIdentifier, referenceType: "GPO"|"REF" } }
   * operationStatus: 1=sucesso, 3=cancelado/expirado, 4=falhado/recusado, 5=erro
   * Validação opcional HMAC via APPYPAY_WEBHOOK_SECRET (x-signature)
   */
  async handleAppyPayWebhook(rawBody: string, headers: Record<string, string>) {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      const res = { ok: false, message: 'Invalid JSON' };
      this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload: rawBody, result: res, error: 'Invalid JSON' }).catch(() => {});
      return res;
    }

    const webhookSecret =
      this.config.get<string>('appypay.webhookSecret') ??
      this.config.get<string>('APPYPAY_WEBHOOK_SECRET') ??
      this.config.get<string>('webhook.paymentSecrets.appypay') ??
      this.config.get<string>('PAYMENT_WEBHOOK_SECRET_APPYPAY') ??
      '';

    if (webhookSecret) {
      const received =
        headers['x-signature'] ??
        (headers as any)['X-Signature'] ??
        headers['x-webhook-signature'] ??
        headers['signature'] ??
        '';
      if (!received) {
        this.logger.warn('AppyPay webhook sem x-signature – validação ignorada (secret configurado mas header ausente)');
      } else {
        const clean = String(received).replace(/^sha256=/, '').trim();
        const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        const altExpected = createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
        const isValid =
          (clean.length === expected.length && timingSafeEqual(Buffer.from(clean, 'utf8'), Buffer.from(expected, 'utf8'))) ||
          (clean.length === altExpected.length && timingSafeEqual(Buffer.from(clean, 'utf8'), Buffer.from(altExpected, 'utf8')));
        if (!isValid) {
          this.logger.warn('AppyPay webhook assinatura inválida');
          throw new BadRequestException({
            error: { code: 'INVALID_SIGNATURE', message: 'Invalid HMAC signature (AppyPay)' },
          });
        }
      }
    } else {
      this.logger.warn('APPYPAY_WEBHOOK_SECRET não configurado – webhook AppyPay sem validação HMAC (dev only)');
    }

    const merchantTransactionId =
      payload.merchantTransactionId ??
      payload.merchant_transaction_id ??
      payload.merchantTxId ??
      payload.externalReference ??
      '';

    const operationStatus = Number(payload.operationStatus ?? payload.operation_status ?? payload.status ?? 0);
    const referenceType = String(payload.operationData?.referenceType ?? payload.referenceType ?? '').toUpperCase(); // GPO | REF
    const gatewayNorm = referenceType === 'GPO' ? 'gpo' : referenceType === 'REF' ? 'gpr' : 'appypay';

    if (!merchantTransactionId) {
      throw new BadRequestException({
        error: { code: 'MISSING_REFERENCE', message: 'merchantTransactionId é obrigatório no webhook AppyPay' },
      });
    }

    const referencia = String(merchantTransactionId).trim();
    const redisKey = `webhook:payment:appypay:${referencia}`;

    // Idempotência Redis
    try {
      const already = await this.redis.exists(redisKey);
      if (already) {
        this.logger.log(`AppyPay webhook idempotent (Redis) ref=${referencia}`);
      const idRes = { ok: true, idempotent: true, message: 'Already processed (Redis)' };
      this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload, result: idRes }).catch(() => {});
      return idRes;
      }
    } catch (e: any) {
      this.logger.warn(`Redis idempotency check AppyPay falhou: ${e.message}`);
    }

    let payment: any = await this.prisma.payment.findFirst({ where: { externalReference: referencia } });
    if (!payment) payment = await this.prisma.payment.findFirst({ where: { bridpayMerchantTxId: referencia } });
    if (!payment) payment = await this.prisma.payment.findFirst({ where: { providerTxId: referencia } });
    if (!payment) payment = await this.prisma.payment.findFirst({ where: { id: referencia } });

    if (!payment) {
      this.logger.warn(`AppyPay webhook sem payment para ref=${referencia} payload=${rawBody}`);
      const errRes = { ok: false, message: `Payment not found for merchantTransactionId=${referencia}` };
      this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload, result: errRes, error: `Payment not found ${referencia}` }).catch(() => {});
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: `Payment not found for merchantTransactionId=${referencia}` },
      });
    }

    if (payment.webhookProcessedAt) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}
      return { ok: true, idempotent: true, message: 'Already processed (DB)' };
    }
    if (payment.status === PaymentStatus.PAID && operationStatus === 1) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
        await this.prisma.payment.update({ where: { id: payment.id }, data: { webhookProcessedAt: new Date() } });
      } catch {}
      return { ok: true, idempotent: true, message: 'Payment already paid' };
    }

    const isSuccess = operationStatus === 1;
    const isFailed = [3, 4, 5].includes(operationStatus);

    if (isFailed) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerDetails: { ...(payment.providerDetails as any), appypayWebhook: payload, gateway: gatewayNorm },
          webhookProcessedAt: new Date(),
        },
      });
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}
      this.logger.log(`AppyPay webhook FALHADO ref=${referencia} status=${operationStatus}`);
      const failRes = { ok: true, status: 'failed', operationStatus, gateway: gatewayNorm };
      this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload, payment, result: failRes }).catch(() => {});
      return failRes;
    }

    if (isSuccess) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerDetails: { ...(payment.providerDetails as any), appypayWebhook: payload, gateway: gatewayNorm },
          webhookProcessedAt: new Date(),
        },
      });
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.PAID } });

      await this.auditoria
        .registar(`system-webhook-appypay`, `webhook_appypay_${gatewayNorm}_confirmed`, 'payment', payment.id, {
          merchantTransactionId: referencia,
          operationStatus,
          gateway: gatewayNorm,
          payload,
        })
        .catch(() => {});

      await this.prisma.walletTransaction.create({
        data: {
          type: 'credit',
          amount: payment.amount,
          balanceBefore: 0,
          balanceAfter: 0,
          status: 'settled',
          referenceType: 'payment_intent',
          referenceId: payment.id,
          description: `Webhook AppyPay/${gatewayNorm} confirmado ref ${referencia}`,
          orderId: payment.orderId,
          paymentId: payment.id,
          bridpayTxId: referencia,
        },
      });

      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}

      try {
        const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
        if (order) {
          await this.notificationsService.criar(
            order.buyerId,
            'Pagamento confirmado',
            `O pagamento do pedido #${payment.orderId.slice(0, 8)} foi confirmado via ${gatewayNorm.toUpperCase()} (AppyPay)`,
          );
        }
      } catch (e: any) {
        this.logger.warn(`Notificação AppyPay falhou: ${e.message}`);
      }

      try {
        await this.paymentQueue.enqueuePaymentConfirmed({
          paymentId: payment.id,
          orderId: payment.orderId,
          buyerId: (await this.prisma.order.findUnique({ where: { id: payment.orderId } }))?.buyerId ?? '',
          gateway: gatewayNorm,
          referenciaExterna: referencia,
          amount: payment.amount,
          confirmedAt: new Date().toISOString(),
        });
      } catch (e: any) {
        this.logger.warn(`Enqueue BullMQ AppyPay falhou: ${e.message}`);
      }

      try {
        const orderForWs = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
        if (orderForWs) {
          this.realtime.emitPaymentConfirmed(orderForWs.buyerId, {
            orderId: payment.orderId,
            paymentId: payment.id,
            amount: payment.amount,
            gateway: `appypay_${gatewayNorm}`,
            externalReference: referencia,
            orderStatus: 'PAID',
          });
        }
      } catch (e: any) {
        this.logger.warn(`Realtime AppyPay falhou: ${e.message}`);
      }

      const appRes = { ok: true, status: 'paid', operationStatus, gateway: gatewayNorm, externalReference: referencia };
      this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload, payment, result: appRes }).catch(() => {});
      return appRes;
    }

    // status pendente/desconhecido
    this.logger.log(`AppyPay webhook pendente ref=${referencia} status=${operationStatus}`);
    const pendRes = { ok: true, status: 'pending', operationStatus, gateway: gatewayNorm };
    this.notifyWebhookEmail({ gateway: 'appypay', rawBody, headers, payload, payment, result: pendRes }).catch(() => {});
    return pendRes;
  }

  // ─── Webhook genérico POST /webhooks/pagamento/:gateway (público, HMAC, idempotente) ───
  async handlePagamentoWebhook(
    gateway: string,
    rawBody: string,
    headers: Record<string, string>,
    payload: any,
  ) {
    const gatewayNorm = String(gateway).toLowerCase().trim();

    // 1. Validação HMAC genérica configurável por env
    // Suporta PAYMENT_WEBHOOK_SECRET (genérico) e PAYMENT_WEBHOOK_SECRET_<GATEWAY> (ex: PAYMENT_WEBHOOK_SECRET_EKWANZA)
    // configuration.ts popula webhook.paymentSecret e webhook.paymentSecrets a partir de process.env, por isso basta ler via ConfigService.
    const genericSecret =
      this.config.get<string>('webhook.paymentSecret') ||
      this.config.get<string>('PAYMENT_WEBHOOK_SECRET') ||
      this.config.get<string>('WEBHOOK_PAYMENT_SECRET') ||
      this.config.get<string>('WEBHOOK_SECRET') ||
      '';
    const perGatewaySecret =
      this.config.get<string>(`webhook.paymentSecrets.${gatewayNorm}`) ||
      this.config.get<string>(`PAYMENT_WEBHOOK_SECRET_${gatewayNorm.toUpperCase()}`) ||
      '';
    const webhookSecret = perGatewaySecret || genericSecret;

    if (webhookSecret) {
      const signatureHeader =
        headers['x-signature'] ??
        headers['x-webhook-signature'] ??
        headers['signature'] ??
        headers['x-hub-signature'] ??
        (headers as any)['X-Signature'];
      if (!signatureHeader) {
        const err = { ok: false, error: 'MISSING_SIGNATURE', message: 'Missing HMAC signature (x-signature)' };
        this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, result: err, error: 'Missing HMAC signature' }).catch(() => {});
        throw new BadRequestException({
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'Missing HMAC signature (x-signature)',
          },
        });
      }
      const received = String(signatureHeader)
        .replace(/^sha256=/, '')
        .trim();
      const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      // também tenta HMAC do payload JSON normalizado (sem espaços) para compatibilidade
      const altExpected = createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      const isValid =
        (received.length === expected.length &&
          timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'))) ||
        (received.length === altExpected.length &&
          timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(altExpected, 'utf8')));
      if (!isValid) {
        const err2 = { ok: false, error: 'INVALID_SIGNATURE', message: 'Invalid HMAC signature' };
        this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, result: err2, error: 'Invalid HMAC signature' }).catch(() => {});
        throw new BadRequestException({
          error: { code: 'INVALID_SIGNATURE', message: 'Invalid HMAC signature' },
        });
      }
    } else {
      this.logger.warn(
        `Webhook pagamento/${gatewayNorm} sem PAYMENT_WEBHOOK_SECRET configurado – validação HMAC ignorada (dev only)`,
      );
    }

    // 2. Extrai referencia_externa como chave idempotente
    const referenciaExterna =
      payload.referencia_externa ??
      payload.referenciaExterna ??
      payload.externalReference ??
      payload.referencia ??
      payload.reference ??
      payload.merchantTxId ??
      payload.merchant_tx_id ??
      payload.merchantTransactionId ??
      payload.paymentId ??
      payload.payment_id ??
      payload.id;

    if (!referenciaExterna) {
      const err3 = { ok: false, error: 'MISSING_REFERENCE', message: 'externalReference is required' };
      this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, result: err3, error: 'Missing externalReference' }).catch(() => {});
      throw new BadRequestException({
        error: {
          code: 'MISSING_REFERENCE',
          message: 'externalReference is required in webhook payload',
        },
      });
    }
    const referencia = String(referenciaExterna).trim();
    const redisKey = `webhook:payment:${gatewayNorm}:${referencia}`;

    // 3. Idempotência: Redis Set/hash + coluna webhookProcessedAt
    try {
      const alreadyInRedis = await this.redis.exists(redisKey);
      if (alreadyInRedis) {
        this.logger.log(
          `Webhook idempotent already processed (Redis) gateway=${gatewayNorm} ref=${referencia}`,
        );
        const idRes = { ok: true, idempotent: true, message: 'Already processed (Redis)' };
        this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, result: idRes }).catch(() => {});
        return idRes;
      }
    } catch (e: any) {
      this.logger.warn(`Redis idempotency check failed: ${e.message}`);
    }

    // Tenta encontrar pagamento por referencia_externa
    let payment: any = await this.prisma.payment.findFirst({
      where: { externalReference: referencia },
    });
    if (!payment)
      payment = await this.prisma.payment.findFirst({ where: { bridpayMerchantTxId: referencia } });
    if (!payment)
      payment = await this.prisma.payment.findFirst({ where: { providerTxId: referencia } });
    if (!payment) payment = await this.prisma.payment.findFirst({ where: { id: referencia } });
    if (!payment) {
      // também tenta por orderId
      const orderId = payload.pedido_id ?? payload.pedidoId ?? payload.orderId ?? payload.order_id;
      if (orderId) {
        payment = await this.prisma.payment.findFirst({ where: { orderId: String(orderId) } });
      }
    }
    if (!payment) {
      const err5 = { ok: false, error: 'NOT_FOUND', message: `Payment not found for externalReference=${referencia}` };
      this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, result: err5, error: `Payment not found ${referencia}` }).catch(() => {});
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: `Payment not found for externalReference=${referencia}`,
        },
      });
    }

    if (payment.webhookProcessedAt) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}
      this.logger.log(
        `Webhook idempotent already processed (DB) payment=${payment.id} ref=${referencia}`,
      );
      const idRes2 = { ok: true, idempotent: true, message: 'Already processed (DB)' };
      this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, payment, result: idRes2 }).catch(() => {});
      return idRes2;
    }
    if (payment.status === PaymentStatus.PAID) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { webhookProcessedAt: new Date() },
        });
      } catch {}
      const alreadyPaidRes = { ok: true, idempotent: true, message: 'Payment already paid' };
      this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, payment, result: alreadyPaidRes }).catch(() => {});
      return alreadyPaidRes;
    }

    // 4. Confirma pagamento: atualiza Pagamento e Pedido, dispara notificação, enfileira BullMQ
    const statusPayload = String(payload.status ?? payload.estado ?? 'paid').toLowerCase();
    const isSuccess = [
      'paid',
      'pago',
      'settled',
      'success',
      'confirmed',
      'confirmado',
      'approved',
    ].includes(statusPayload);
    const isFailed = [
      'failed',
      'falhado',
      'rejected',
      'rejeitado',
      'cancelled',
      'cancelado',
    ].includes(statusPayload);

    if (isFailed) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerDetails: payload,
          webhookProcessedAt: new Date(),
        },
      });
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}
      const failRes = { ok: true, status: 'failed', externalReference: referencia };
      this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, payment, result: failRes }).catch(() => {});
      return failRes;
    }

    // sucesso (default)
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        providerDetails: payload,
        webhookProcessedAt: new Date(),
      },
    });
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.PAID },
    });
    await this.auditoria
      .registar(
        `system-webhook-${gatewayNorm}`,
        `webhook_payment_${gatewayNorm}_confirmed`,
        'payment',
        payment.id,
        { gateway: gatewayNorm, externalReference: referencia, payload },
      )
      .catch(() => {});
    await this.prisma.walletTransaction.create({
      data: {
        type: 'credit',
        amount: payment.amount,
        balanceBefore: 0,
        balanceAfter: 0,
        status: 'settled',
        referenceType: 'payment_intent',
        referenceId: payment.id,
        description: `Webhook pagamento/${gatewayNorm} confirmado ref ${referencia}`,
        orderId: payment.orderId,
        paymentId: payment.id,
        bridpayTxId: referencia,
      },
    });
    try {
      await this.redis.set(redisKey, '1', 7 * 24 * 3600);
    } catch {}
    try {
      const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      if (order) {
        await this.notificationsService.criar(
          order.buyerId,
          'Pagamento confirmado',
          `O pagamento do pedido #${payment.orderId.slice(0, 8)} foi confirmado via ${gatewayNorm} (ref ${referencia})`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`Notificação falhou: ${e.message}`);
    }
    try {
      await this.paymentQueue.enqueuePaymentConfirmed({
        paymentId: payment.id,
        orderId: payment.orderId,
        buyerId:
          (await this.prisma.order.findUnique({ where: { id: payment.orderId } }))?.buyerId ?? '',
        gateway: gatewayNorm,
        referenciaExterna: referencia,
        amount: payment.amount,
        confirmedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      this.logger.warn(`Enqueue BullMQ falhou: ${e.message}`);
    }

    try {
      const orderForWs = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
      if (orderForWs) {
        this.realtime.emitPaymentConfirmed(orderForWs.buyerId, {
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: payment.amount,
          gateway: gatewayNorm,
          externalReference: referencia,
          orderStatus: 'PAID',
        });
      }
    } catch (e: any) {
      this.logger.warn(`Realtime generic falhou: ${e.message}`);
    }

    const okRes = { ok: true, status: 'paid', externalReference: referencia, gateway: gatewayNorm };
    this.notifyWebhookEmail({ gateway: gatewayNorm, rawBody, headers, payload, payment, result: okRes }).catch(() => {});
    return okRes;
  }

  async historico(buyerId: string, dto: PaginationDto) {
    const where: any = {};
    // se buyerId fornecido, filtra por pedidos do comprador
    if (buyerId) {
      const orders = await this.prisma.order.findMany({ where: { buyerId }, select: { id: true } });
      const orderIds = orders.map((o: any) => o.id);
      where.orderId = { in: orderIds };
    }
    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
        include: { order: true },
      }),
    ]);
    const mapped = payments.map(toPaymentResponse);
    return buildPaginatedResponse(mapped, total, dto);
  }

  async historicoAdmin(dto: PaginationDto & { metodo?: string; method?: string; estado?: string; status?: string }) {
    const where: any = {};
    const rawMethod = (dto as any).method ?? (dto as any).metodo;
    if (rawMethod) {
      try {
        where.method = mapMetodoToEnum(String(rawMethod));
      } catch {}
    }
    const rawStatus = (dto as any).status ?? (dto as any).estado;
    if (rawStatus) {
      const s = String(rawStatus).toLowerCase();
      const map: Record<string, PaymentStatus> = {
        pendente: PaymentStatus.PENDING,
        pending: PaymentStatus.PENDING,
        processando: PaymentStatus.PROCESSING,
        processing: PaymentStatus.PROCESSING,
        pago: PaymentStatus.PAID,
        paid: PaymentStatus.PAID,
        falhado: PaymentStatus.FAILED,
        failed: PaymentStatus.FAILED,
        reembolsado: PaymentStatus.REFUNDED,
        refunded: PaymentStatus.REFUNDED,
      };
      if (map[s]) where.status = map[s];
    }
    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
        include: { order: true },
      }),
    ]);
    return buildPaginatedResponse(payments.map(toPaymentResponse), total, dto);
  }

  async walletHistorico(buyerId: string | null, dto: PaginationDto & { tipo?: string; type?: string }) {
    const where: any = {};
    if (buyerId) {
      const orders = await this.prisma.order.findMany({ where: { buyerId }, select: { id: true } });
      const orderIds = orders.map((o: any) => o.id);
      where.orderId = { in: orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'] };
    }
    const rawType = (dto as any).type ?? (dto as any).tipo;
    if (rawType) {
      const t = String(rawType).toLowerCase();
      if (t === 'entrada' || t === 'credit' || t === 'credito') where.type = 'credit';
      if (t === 'saida' || t === 'saída' || t === 'debit' || t === 'debito') where.type = 'debit';
    }
    const [total, txs] = await Promise.all([
      this.prisma.walletTransaction.count({ where }),
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);
    const mapped = txs.map((tx: any) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      status: tx.status,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      description: tx.description,
      orderId: tx.orderId,
      paymentId: tx.paymentId,
      bridpayTxId: tx.bridpayTxId ?? null,
      createdAt: tx.createdAt,
    }));
    return buildPaginatedResponse(mapped, total, dto);
  }
}
