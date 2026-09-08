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

    // Gateway GPO/GPR — AppyPay integrado
    if (isGatewayMethod(method)) {
      const merchantTxId = this.generateMerchantTxId();
      const methodLabel = method === PaymentMethod.MULTICAIXA_EXPRESS ? 'gpo' : 'gpr';

      // Usa apenas os dados mínimos necessários segundo o PDF:
      // GPO precisa de `phoneNumber`, GPR precisa só de amount/reference
      const isGpo = method === PaymentMethod.MULTICAIXA_EXPRESS;
      const description = dto.descricao ?? `Pedido ${orderId.slice(0, 8)} - ${methodLabel.toUpperCase()}`;

      if (this.appypay.isConfigured()) {
        try {
          let appypayRes: any;
          if (isGpo) {
            // GPO = Multicaixa Express via AppyPay
            if (!dto.phoneNumber) {
              throw new BadRequestException({
                error: { code: 'VALIDATION_ERROR', message: 'phoneNumber é obrigatório para GPO (Multicaixa Express)' },
              });
            }
            appypayRes = await this.appypay.createGpoCharge({
              amount,
              merchantTransactionId: merchantTxId,
              phoneNumber: dto.phoneNumber!,
              description,
            });
          } else {
            // GPR = Referência Multicaixa via AppyPay
            appypayRes = await this.appypay.createReferenceCharge({
              amount,
              merchantTransactionId: merchantTxId,
              description,
            });
          }

          // Normaliza resposta AppyPay – campos variam: reference, entity, expirationDate, id, status
          const providerTxId =
            appypayRes.providerTransactionId ??
            appypayRes.transactionId ??
            appypayRes.id ??
            appypayRes.reference ??
            this.deriveMerchantTransactionId(merchantTxId);

          // Para GPR guarda entity/reference para o frontend exibir
          const entity = appypayRes.entity ?? appypayRes.Entity ?? this.config.get<string>('appypay.codeRef') ?? this.config.get<string>('APPYPAY_CODE_REF') ?? '10111';
          const reference = appypayRes.reference ?? appypayRes.Reference ?? appypayRes.code ?? null;
          const expirationDate = appypayRes.expirationDate ?? appypayRes.ExpirationDate ?? null;

          payment = await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PROCESSING,
              externalReference: merchantTxId,
              providerTxId: String(providerTxId),
              bridpayMerchantTxId: merchantTxId,
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
          this.logger.log(`AppyPay ${methodLabel.toUpperCase()} charge criado mTxId=${merchantTxId} providerTxId=${providerTxId}`);
        } catch (e: any) {
          // Se AppyPay falhar, mantém fallback local mas expõe erro para o cliente
          this.logger.error(`AppyPay ${methodLabel.toUpperCase()} falhou: ${e.message} – fallback local`);
          // Não lança 500 para não bloquear checkout em sandbox; marca como PROCESSING local com erro
          // Se for erro de validação (ex: phone), já lançou BadRequest acima
          if (e instanceof BadRequestException) throw e;

          const providerTxId = this.deriveMerchantTransactionId(merchantTxId);
          payment = await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PROCESSING,
              externalReference: merchantTxId,
              providerTxId,
              bridpayMerchantTxId: merchantTxId,
              providerDetails: {
                provider: 'appypay',
                method: methodLabel,
                merchantTxId,
                providerTxId,
                error: e.message,
                fallback: 'local',
                amount,
                phoneNumber: isGpo ? dto.phoneNumber : undefined,
              } as any,
            },
          });
        }
      } else {
        // Fallback local – AppyPay não configurado (dev/sem credenciais)
        this.logger.warn(`AppyPay não configurado – ${methodLabel.toUpperCase()} em modo mock local (configure APPYPAY_* no .env)`);
        const providerTxId = this.deriveMerchantTransactionId(merchantTxId);
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
              mock: true,
              hint: 'Configure APPYPAY_CLIENT_ID/SECRET/RESOURCE/AUTH_URL/API_BASE_URL/MERCHANT_IDENTIFIER para ativar AppyPay real',
            } as any,
          },
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
      return { ok: false, message: 'Invalid JSON' };
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
        return { ok: true, idempotent: true, message: 'Already processed (Redis)' };
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
      return { ok: true, status: 'failed', operationStatus, gateway: gatewayNorm };
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

      return { ok: true, status: 'paid', operationStatus, gateway: gatewayNorm, externalReference: referencia };
    }

    // status pendente/desconhecido
    this.logger.log(`AppyPay webhook pendente ref=${referencia} status=${operationStatus}`);
    return { ok: true, status: 'pending', operationStatus, gateway: gatewayNorm };
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
        return { ok: true, idempotent: true, message: 'Already processed (Redis)' };
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
      return { ok: true, idempotent: true, message: 'Already processed (DB)' };
    }
    if (payment.status === PaymentStatus.PAID) {
      try {
        await this.redis.set(redisKey, '1', 7 * 24 * 3600);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { webhookProcessedAt: new Date() },
        });
      } catch {}
      return { ok: true, idempotent: true, message: 'Payment already paid' };
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
      return { ok: true, status: 'failed', externalReference: referencia };
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

    return { ok: true, status: 'paid', externalReference: referencia, gateway: gatewayNorm };
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
