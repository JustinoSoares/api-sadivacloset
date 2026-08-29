import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, DeliveryStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const otherId = '99999999-9999-9999-9999-999999999999';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const productId = '33333333-3333-3333-3333-333333333333';
  const addressId = '44444444-4444-4444-4444-444444444444';

  const orderMock: any = {
    id: orderId,
    buyerId,
    subtotal: 10000,
    deliveryFee: 1000,
    total: 11000,
    status: OrderStatus.AWAITING_PAYMENT,
    createdAt: new Date(),
    items: [
      { id: 'oi1', orderId, productId, productName: 'Prod', unitPrice: 10000, discount: 0, quantity: 2 },
    ],
    delivery: {
      id: 'del1',
      orderId,
      type: 'HOME_DELIVERY',
      addressId,
      scheduledDate: new Date('2026-09-10'),
      timeWindow: '09:00-12:00',
      status: DeliveryStatus.SCHEDULED,
      deliveryFee: 1000,
      instructions: null,
    },
    payment: null,
  };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn(), count: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      delivery: { create: jest.fn(), update: jest.fn() },
      product: { update: jest.fn() },
      address: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: any) => {
        const tx = {
          product: { update: jest.fn().mockResolvedValue({}) },
          order: {
            update: jest.fn().mockResolvedValue({ ...orderMock, status: OrderStatus.CANCELLED }),
            findUnique: jest.fn().mockResolvedValue({ ...orderMock, status: OrderStatus.CANCELLED, delivery: { ...orderMock.delivery, status: DeliveryStatus.CANCELLED } }),
          },
          delivery: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  describe('findOne', () => {
    it('should return detail if owner', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      const result = await service.findOne(buyerId, orderId);
      expect(result.id).toBe(orderId);
      expect(result.itens).toHaveLength(1);
      expect(result.entrega).toBeDefined();
    });
    it('should throw 404 if not owner', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...orderMock, buyerId: otherId });
      await expect(service.findOne(buyerId, orderId)).rejects.toBeInstanceOf(NotFoundException);
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne(buyerId, orderId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAllPaginated', () => {
    it('should paginate', async () => {
      prisma.order.count.mockResolvedValue(1);
      prisma.order.findMany.mockResolvedValue([orderMock]);
      const dto = new PaginationDto();
      dto.page = 1;
      dto.limit = 20;
      const result = await service.findAllPaginated(buyerId, dto);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.pagina).toBe(1);
    });
  });

  describe('cancel', () => {
    it('should cancel and restore stock', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      const result = await service.cancel(buyerId, orderId);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.estado).toBe(OrderStatus.CANCELLED);
    });
    it('should block if delivery ON_THE_WAY (a_caminho/em_entrega)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...orderMock,
        delivery: { ...orderMock.delivery, status: DeliveryStatus.ON_THE_WAY },
        status: OrderStatus.SHIPPING,
      });
      await expect(service.cancel(buyerId, orderId)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.cancel(buyerId, orderId)).rejects.toMatchObject({ response: { erro: { codigo: 'ENTREGA_EM_CURSO' } } });
    });
    it('should block if already cancelled', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...orderMock, status: OrderStatus.CANCELLED });
      await expect(service.cancel(buyerId, orderId)).rejects.toBeInstanceOf(BadRequestException);
    });
    it('should throw 404 if not owner', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancel(buyerId, orderId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('upsertDelivery', () => {
    it('should update existing delivery', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce(orderMock) // first call for ownership
        .mockResolvedValueOnce({ ...orderMock, delivery: { ...orderMock.delivery } }) // second for findUnique after update? actually service does second findUnique after update via prisma.order.findUnique
        .mockResolvedValueOnce({ ...orderMock, delivery: { ...orderMock.delivery, timeWindow: '14:00-18:00' } });
      prisma.delivery.update.mockResolvedValue({ ...orderMock.delivery, timeWindow: '14:00-18:00' });
      prisma.order.findUnique.mockResolvedValue({
        ...orderMock,
        delivery: { ...orderMock.delivery },
        items: orderMock.items,
        payment: null,
      });
      // simpler: mock address not needed
      // create a mock that returns order with delivery
      prisma.address.findUnique.mockResolvedValue(null);
      // override to test update path
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      // need to setup prisma mocks for second part
      const mockOrder = { ...orderMock, delivery: { ...orderMock.delivery, status: DeliveryStatus.SCHEDULED } };
      prisma.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      prisma.delivery.update = jest.fn().mockResolvedValue({ ...mockOrder.delivery, timeWindow: '14:00-18:00' });
      // after update, order findUnique returns updated
      prisma.order.findUnique
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce({ ...mockOrder, delivery: { ...mockOrder.delivery, timeWindow: '14:00-18:00' } });

      const result = await service.upsertDelivery(buyerId, orderId, { janelaHorario: '14:00-18:00' });
      expect(prisma.delivery.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should validate endereco ownership', async () => {
      prisma.order.findUnique.mockResolvedValue(orderMock);
      prisma.address.findUnique.mockResolvedValue(null);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await expect(service.upsertDelivery(buyerId, orderId, { enderecoId: addressId })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
