import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminOrdersService } from './admin-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from '@prisma/client';

describe('AdminOrdersService', () => {
  let service: AdminOrdersService;
  let prisma: any;
  let notifications: any;
  let audit: any;

  const adminId = 'admin-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const buyerId = '33333333-3333-3333-3333-333333333333';

  const orderMock: any = {
    id: orderId,
    buyerId,
    subtotal: 10000,
    deliveryFee: 1000,
    total: 11000,
    status: OrderStatus.AWAITING_PAYMENT,
    createdAt: new Date('2026-06-01'),
    buyer: { id: buyerId, name: 'Buyer', email: 'buyer@test.com' },
    items: [],
    delivery: null,
    payment: null,
  };

  beforeEach(async () => {
    prisma = {
      order: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    notifications = { criar: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({}) };
    audit = { register: jest.fn().mockResolvedValue({}), registar: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditService, useValue: audit },
        AdminOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get<AdminOrdersService>(AdminOrdersService);
  });

  it('should paginate with filters status and date', async () => {
    prisma.order.count.mockResolvedValue(1);
    prisma.order.findMany.mockResolvedValue([orderMock]);
    const dto = new FilterOrdersDto();
    (dto as any).estado = 'pago';
    dto.page = 1;
    dto.limit = 20;
    dto.estado = 'pago' as any;
    const result = await service.findAll(dto);
    expect(prisma.order.count).toHaveBeenCalled();
    const where = prisma.order.count.mock.calls[0][0].where;
    expect(where.status).toBe(OrderStatus.PAID);
    expect(result.total).toBe(1);
  });

  it('should paginate with date range', async () => {
    prisma.order.count.mockResolvedValue(0);
    prisma.order.findMany.mockResolvedValue([]);
    const dto = new FilterOrdersDto();
    dto.data_inicio = '2026-01-01';
    dto.data_fim = '2026-12-31';
    dto.page = 1;
    dto.limit = 10;
    await service.findAll(dto);
    const where = prisma.order.count.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);
  });

  it('should update status, record audit and notify', async () => {
    prisma.order.findUnique.mockResolvedValue(orderMock);
    prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.PAID });
    const dto = new UpdateOrderStatusDto();
    dto.estado = 'pago';
    const result = await service.updateStatus(adminId, orderId, dto);
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OrderStatus.PAID } }));
    expect(audit.register).toHaveBeenCalledWith(adminId, 'update_order_status', 'order', orderId, expect.any(Object));
    expect(result.estado).toBe(OrderStatus.PAID);
    expect(result.status).toBe(OrderStatus.PAID);
  });

  it('should throw 400 for invalid status', async () => {
    const dto = new UpdateOrderStatusDto();
    dto.estado = 'invalido';
    await expect(service.updateStatus(adminId, orderId, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should throw 404 if order not exists', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    const dto = new UpdateOrderStatusDto();
    dto.estado = 'pago';
    await expect(service.updateStatus(adminId, 'no-id', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should accept english alias status', async () => {
    prisma.order.findUnique.mockResolvedValue(orderMock);
    prisma.order.update.mockResolvedValue({ ...orderMock, status: OrderStatus.COMPLETED });
    const dto = new UpdateOrderStatusDto();
    dto.status = 'completed';
    const result = await service.updateStatus(adminId, orderId, dto);
    expect(result.estado).toBe(OrderStatus.COMPLETED);
  });
});

// legacy alias suite
describe('AdminPedidosService', () => {
  it('alias should exist', () => {
    expect(AdminOrdersService).toBeDefined();
  });
});
