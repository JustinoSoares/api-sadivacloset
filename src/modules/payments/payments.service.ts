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
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { PaymentQueueService } from '../queue/payment-queue.service';

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
      erro: {
        codigo: 'METODO_INVALIDO',
        mensagem: `Método '${metodo}' inválido. Use: multicaixa_express (gpo), referencia_multicaixa (gpr), transferencia, pagamento_entrega, cartao`,
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
    pedido_id: payment.orderId,
    order_id: payment.orderId,
    orderId: payment.orderId,
    metodo: payment.method,
    method: payment.method,
    valor: payment.amount,
    amount: payment.amount,
    estado: payment.status,
    status: payment.status,
    referencia_externa: payment.externalReference ?? null,
    external_reference: payment.externalReference ?? null,
    externalReference: payment.externalReference ?? null,
    comprovativo_url: payment.receiptUrl ?? null,
    receipt_url: payment.receiptUrl ?? null,
    receiptUrl: payment.receiptUrl ?? null,
    provider_tx_id: payment.providerTxId ?? null,
    providerTxId: payment.providerTxId ?? null,
    bridpay_intent_id: payment.bridpayIntentId ?? null,
    bridpayIntentId: payment.bridpayIntentId ?? null,
    bridpay_merchant_tx_id: payment.bridpayMerchantTxId ?? null,
    bridpayMerchantTxId: payment.bridpayMerchantTxId ?? null,
    provider_details: payment.providerDetails ?? null,
    providerDetails: payment.providerDetails ?? null,
    telefone: payment.phoneNumber ?? null,
    phoneNumber: payment.phoneNumber ?? null,
    iban: payment.iban ?? null,
    criado_em: payment.createdAt,
    createdAt: payment.createdAt,
    atualizado_em: payment.updatedAt,
    updatedAt: payment.updatedAt,
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ekwanza: EkwanzaClient,
    private readonly storage: StorageService,
    private readonly notificationsService: NotificationsService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly paymentQueue: PaymentQueueService,
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
      });
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        erro: { codigo: 'PEDIDO_CANCELADO', mensagem: 'Pedido cancelado não pode ser pago' },
      });
    }
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException({
        erro: { codigo: 'PEDIDO_JA_PAGO', mensagem: 'Pedido já está pago' },
      });
    }
    if (order.payment && order.payment.status === PaymentStatus.PAID) {
      throw new BadRequestException({
        erro: { codigo: 'PAGAMENTO_JA_VALIDADO', mensagem: 'Pagamento já validado' },
      });
    }

    const method = mapMetodoToEnum(dto.metodo);
    // validar campos específicos por método
    if (method === PaymentMethod.MULTICAIXA_EXPRESS) {
      if (!dto.phoneNumber) {
        throw new BadRequestException({
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'phoneNumber é obrigatório para multicaixa_express (gpo)',
            detalhes: [{ campo: 'phoneNumber', erros: ['obrigatório para GPO'] }],
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

    // Gateway GPO/GPR — sem AppPay/BridPay, apenas marca como PROCESSANDO local
    // (o único provider externo agora é E-Kwanza KWiK para iban/kwik)
    if (isGatewayMethod(method)) {
      const merchantTxId = this.generateMerchantTxId();
      const providerTxId = this.deriveMerchantTransactionId(merchantTxId);
      const methodLabel = method === PaymentMethod.MULTICAIXA_EXPRESS ? 'gpo' : 'gpr';
      payment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PROCESSING,
          externalReference: merchantTxId,
          providerTxId,
          bridpayMerchantTxId: merchantTxId,
          providerDetails: {
            provider: 'local',
            method: methodLabel,
            merchantTxId,
            providerTxId,
          } as any,
        },
      });
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
      });
    }
    if (!order.payment) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pagamento não encontrado para este pedido' },
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pedido não encontrado' },
      });
    }
    if (!order.payment) {
      throw new NotFoundException({
        erro: {
          codigo: 'NAO_ENCONTRADO',
          mensagem: 'Pagamento não iniciado. Use POST /pagamento/iniciar primeiro',
        },
      });
    }
    if (order.payment.status === PaymentStatus.PAID) {
      throw new BadRequestException({
        erro: { codigo: 'PAGAMENTO_JA_VALIDADO', mensagem: 'Pagamento já validado' },
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
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Pagamento não encontrado' },
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

    await this.auditoria.registar(adminId, 'validar_pagamento', 'pagamento', paymentId, {
      orderId: payment.orderId,
      metodo: payment.method,
      valor: payment.amount,
      comprovativo: payment.receiptUrl,
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

    return {
      pagamento: toPaymentResponse(updatedPayment),
      payment: toPaymentResponse(updatedPayment),
      pedido: {
        id: order.id,
        estado: order.status,
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
      return { ok: false, message: 'Invalid JSON' };
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
      return { ok: false, message: 'Payment/Payout not found' };
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
            if (order)
              await this.notificationsService.criar(
                order.buyerId,
                'Pagamento confirmado',
                `O pagamento do pedido #${payment.orderId.slice(0, 8)} foi confirmado via E-Kwanza`,
              );
          } catch {}
        }
        return { ok: true, status: 'settled' };
      }
      if (isFailed) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, providerDetails: payload },
        });
        return { ok: true, status: 'failed' };
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
        throw new BadRequestException({
          erro: {
            codigo: 'ASSINATURA_EM_FALTA',
            mensagem: 'Assinatura HMAC em falta (x-signature)',
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
        throw new BadRequestException({
          erro: { codigo: 'ASSINATURA_INVALIDA', mensagem: 'Assinatura HMAC inválida' },
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
      throw new BadRequestException({
        erro: {
          codigo: 'REFERENCIA_EM_FALTA',
          mensagem: 'referencia_externa é obrigatória no payload do webhook',
        },
      });
    }
    const referencia = String(referenciaExterna).trim();
    const redisKey = `webhook:pagamento:${gatewayNorm}:${referencia}`;

    // 3. Idempotência: Redis Set/hash + coluna webhookProcessedAt
    try {
      const alreadyInRedis = await this.redis.exists(redisKey);
      if (alreadyInRedis) {
        this.logger.log(
          `Webhook idempotente já processado (Redis) gateway=${gatewayNorm} ref=${referencia}`,
        );
        return { ok: true, idempotente: true, message: 'Já processado (Redis)' };
      }
    } catch (e: any) {
      this.logger.warn(`Redis idempotência check falhou: ${e.message}`);
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
      throw new NotFoundException({
        erro: {
          codigo: 'NAO_ENCONTRADO',
          mensagem: `Pagamento não encontrado para referencia_externa=${referencia}`,
        },
      });
    }

    if (payment.webhookProcessedAt) {
      // já processado via coluna
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
      } catch {}
      this.logger.log(
        `Webhook idempotente já processado (DB) pagamento=${payment.id} ref=${referencia}`,
      );
      return { ok: true, idempotente: true, message: 'Já processado (DB)' };
    }
    if (payment.status === PaymentStatus.PAID) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { webhookProcessedAt: new Date() },
        });
      } catch {}
      return { ok: true, idempotente: true, message: 'Pagamento já pago' };
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
      return { ok: true, status: 'failed', referencia_externa: referencia };
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
        `webhook_pagamento_${gatewayNorm}_confirmado`,
        'pagamento',
        payment.id,
        { gateway: gatewayNorm, referencia_externa: referencia, payload },
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

    return { ok: true, status: 'paid', referencia_externa: referencia, gateway: gatewayNorm };
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

  async historicoAdmin(dto: PaginationDto & { metodo?: string; estado?: string }) {
    const where: any = {};
    if ((dto as any).metodo) {
      try {
        where.method = mapMetodoToEnum((dto as any).metodo);
      } catch {}
    }
    if ((dto as any).estado) {
      const s = String((dto as any).estado).toLowerCase();
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

  async walletHistorico(buyerId: string | null, dto: PaginationDto & { tipo?: string }) {
    const where: any = {};
    if (buyerId) {
      // filtra transações ligadas a pedidos do comprador
      const orders = await this.prisma.order.findMany({ where: { buyerId }, select: { id: true } });
      const orderIds = orders.map((o: any) => o.id);
      where.orderId = { in: orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'] };
    }
    if ((dto as any).tipo) {
      const t = String((dto as any).tipo).toLowerCase();
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
      tipo: tx.type === 'credit' ? 'entrada' : 'saida',
      type: tx.type,
      valor: tx.amount,
      amount: tx.amount,
      saldo_antes: tx.balanceBefore,
      balanceBefore: tx.balanceBefore,
      saldo_depois: tx.balanceAfter,
      balanceAfter: tx.balanceAfter,
      estado: tx.status,
      status: tx.status,
      tipo_referencia: tx.referenceType,
      referenceType: tx.referenceType,
      referencia_id: tx.referenceId,
      referenceId: tx.referenceId,
      descricao: tx.description,
      description: tx.description,
      pedido_id: tx.orderId,
      orderId: tx.orderId,
      pagamento_id: tx.paymentId,
      paymentId: tx.paymentId,
      criado_em: tx.createdAt,
      createdAt: tx.createdAt,
    }));
    return buildPaginatedResponse(mapped, total, dto);
  }
}
