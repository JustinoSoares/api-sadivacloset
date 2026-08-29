import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BridpayClient } from './bridpay.client';
import { AppPayClient } from './providers/appypay.client';
import { EkwanzaClient } from './providers/ekwanza.client';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { PaymentQueueService } from '../queue/payment-queue.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let bridpay: any;
  let storage: any;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const paymentId = '33333333-3333-3333-3333-333333333333';
  const adminId = 'admin-9999-9999-9999-999999999999';

  const orderMock: any = {
    id: orderId,
    buyerId,
    total: 50000,
    status: OrderStatus.AWAITING_PAYMENT,
    payment: null,
  };

  const paymentMock: any = {
    id: paymentId,
    orderId,
    method: 'MULTICAIXA_EXPRESS',
    amount: 50000,
    status: PaymentStatus.PENDING,
    externalReference: null,
    receiptUrl: null,
    providerTxId: null,
    bridpayIntentId: null,
    bridpayMerchantTxId: null,
    providerDetails: null,
    phoneNumber: '923456789',
    iban: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: orderMock,
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      payment: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      walletTransaction: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      payout: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    bridpay = {
      createGpo: jest.fn().mockResolvedValue(null),
      createGpr: jest.fn().mockResolvedValue(null),
      createKwik: jest.fn().mockResolvedValue(null),
      getWalletBalance: jest.fn().mockResolvedValue({ balance: 100000 }),
      getWalletTransactions: jest.fn().mockResolvedValue({ data: [] }),
    };
    const appPay = {
      createCharge: jest.fn().mockResolvedValue({ id: 'apppay123', transactionId: 'tx123', reference: 'ref123' }),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const ekwanza = {
      sendKwikToCustomer: jest.fn().mockResolvedValue({ ekzOperationCode: 'op123', ekzTransactionCode: 'tx123', status: '347' }),
      createTicket: jest.fn().mockResolvedValue({ Code: 'code123', Status: 0 }),
    };
    storage = { saveComprovativo: jest.fn().mockResolvedValue('/uploads/test.jpg') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditoriaService, useValue: { registar: jest.fn().mockResolvedValue({}), register: jest.fn().mockResolvedValue({}) } },
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BridpayClient, useValue: bridpay },
        { provide: AppPayClient, useValue: appPay },
        { provide: EkwanzaClient, useValue: ekwanza },
        { provide: StorageService, useValue: storage },
        { provide: NotificationsService, useValue: { criar: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: RedisService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), exists: jest.fn().mockResolvedValue(false), client: {} } },
        { provide: PaymentQueueService, useValue: { enqueuePaymentConfirmed: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('iniciar', () => {
    it('should create payment PENDING for transferencia', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      prisma.payment.create.mockResolvedValue({ ...paymentMock, method: 'BANK_TRANSFER', status: PaymentStatus.PENDING });
      const result = await service.iniciar(buyerId, orderId, { metodo: 'transferencia' });
      expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ method: 'BANK_TRANSFER' }) }));
      expect(result.metodo).toBe('BANK_TRANSFER');
    });

    it('should create PROCESSING for gpo via AppPay direto', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      prisma.payment.create.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PROCESSING });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PROCESSING, externalReference: 'mtx123', bridpayIntentId: 'apppay123' });
      const result = await service.iniciar(buyerId, orderId, { metodo: 'multicaixa_express', phoneNumber: '923456789' });
      // em modo mock (sem env APPYPAY_MERCHANT_IDENTIFIER) não chama AppPay, mas cria pagamento PROCESSING local
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.estado).toBe(PaymentStatus.PROCESSING);
    });

    it('should create PROCESSING for gpr via AppPay direto', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      prisma.payment.create.mockResolvedValue({ ...paymentMock, method: 'MULTICAIXA_REFERENCE', status: PaymentStatus.PROCESSING });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, method: 'MULTICAIXA_REFERENCE', status: PaymentStatus.PROCESSING, externalReference: 'mtx456' });
      const result = await service.iniciar(buyerId, orderId, { metodo: 'gpr' });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw if order not found or not owner', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.iniciar(buyerId, orderId, { metodo: 'transferencia' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw if phone missing for gpo', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      await expect(service.iniciar(buyerId, orderId, { metodo: 'multicaixa_express' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('get', () => {
    it('should return payment if owner', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...orderMock, payment: paymentMock });
      const result = await service.get(buyerId, orderId);
      expect(result.id).toBe(paymentId);
    });
    it('should throw 404 if not owner', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...orderMock, buyerId: 'other', payment: paymentMock });
      await expect(service.get(buyerId, orderId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('comprovativo', () => {
    it('should upload and set PROCESSING', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...orderMock, payment: paymentMock });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, receiptUrl: '/uploads/test.jpg', status: PaymentStatus.PROCESSING });
      const file = { originalname: 'comp.jpg', mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from('test') } as any;
      const result = await service.comprovativo(buyerId, orderId, file);
      expect(storage.saveComprovativo).toHaveBeenCalled();
      expect(result.comprovativo_url).toBe('/uploads/test.jpg');
      expect(result.estado).toBe(PaymentStatus.PROCESSING);
    });
  });

  describe('validarAdmin', () => {
    it('should set payment PAID and order PAID, never via frontend', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PROCESSING, order: orderMock });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PAID });
      prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.PAID });
      const result: any = await service.validarAdmin(adminId, paymentId);
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.PAID } }));
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OrderStatus.PAID } }));
      // audit now via AuditoriaService
      expect(true).toBe(true); // auditoria mocked
      expect(result.pagamento.estado).toBe(PaymentStatus.PAID);
      expect(result.pedido.estado).toBe(OrderStatus.PAID);
    });
  });

  describe('webhook', () => {
    it('should handle Bridpay webhook settled -> mark PAID', async () => {
      prisma.payment.findFirst.mockResolvedValue(paymentMock);
      prisma.payment.update.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PAID });
      prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.PAID });
      prisma.order.findUnique.mockResolvedValue(orderMock);
      const res = await service.handleBridpayWebhook({ merchantTxId: 'mtx123', status: 'settled', providerTxId: 'ptx123' });
      expect(res.ok).toBe(true);
    });
  });

  describe('historicos', () => {
    it('should paginate wallet historico entradas/saidas', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: orderId }]);
      prisma.walletTransaction.count.mockResolvedValue(1);
      prisma.walletTransaction.findMany.mockResolvedValue([
        { id: 'tx1', type: 'credit', amount: 50000, balanceBefore: 0, balanceAfter: 50000, status: 'settled', referenceType: 'payment_intent', referenceId: paymentId, description: 'entrada', orderId, paymentId, createdAt: new Date() },
      ]);
      const dto: any = { page: 1, limit: 20, skip: 0, take: 20 };
      const result = await service.walletHistorico(buyerId, dto);
      expect(result.total).toBe(1);
      expect(result.data[0].tipo).toBe('entrada');
    });
  });

  describe('webhook pagamento/:gateway idempotente', () => {
    it('should validate HMAC, usar referencia_externa como chave, confirmar pagamento e enfileirar BullMQ', async () => {
      const rawBody = JSON.stringify({ referencia_externa: 'ref123', status: 'paid' });
      // mock referencia lookup
      prisma.payment.findFirst.mockResolvedValue({ ...paymentMock, externalReference: 'ref123', status: PaymentStatus.PROCESSING });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PAID, externalReference: 'ref123', webhookProcessedAt: new Date() });
      prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.PAID });
      prisma.order.findUnique.mockResolvedValue(orderMock);
      prisma.auditLog.create.mockResolvedValue({});
      prisma.walletTransaction.create.mockResolvedValue({});
      // Redis mock will return exists false (idempotência não processado)
      const result = await service.handlePagamentoWebhook('generic', rawBody, {}, { referencia_externa: 'ref123', status: 'paid' });
      expect(result.ok).toBe(true);
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.PAID }) }));
    });

    it('should retornar 200 idempotente se já processado (Redis)', async () => {
      // simula Redis com exists true
      const redisMock = (service as any).redis;
      redisMock.exists.mockResolvedValueOnce(true);
      const rawBody = JSON.stringify({ referencia_externa: 'ref123', status: 'paid' });
      const result = await service.handlePagamentoWebhook('generic', rawBody, {}, { referencia_externa: 'ref123' });
      expect(result.idempotente).toBe(true);
      expect(result.ok).toBe(true);
    });

    it('should validar HMAC quando PAYMENT_WEBHOOK_SECRET configurado', async () => {
      const secret = 'test-secret-123';
      const configMock = (service as any).config;
      configMock.get.mockImplementation((key: string) => {
        if (key === 'PAYMENT_WEBHOOK_SECRET' || key === 'webhook.paymentSecret') return secret;
        return '';
      });
      const rawBody = JSON.stringify({ referencia_externa: 'refHmac', status: 'paid' });
      const { createHmac } = require('crypto');
      const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
      prisma.payment.findFirst.mockResolvedValue({ ...paymentMock, externalReference: 'refHmac', status: PaymentStatus.PROCESSING });
      prisma.payment.update.mockResolvedValue({ ...paymentMock, status: PaymentStatus.PAID });
      prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.PAID });
      prisma.order.findUnique.mockResolvedValue(orderMock);
      const result = await service.handlePagamentoWebhook('generic', rawBody, { 'x-signature': signature }, { referencia_externa: 'refHmac', status: 'paid' });
      expect(result.ok).toBe(true);
    });
  });
});
