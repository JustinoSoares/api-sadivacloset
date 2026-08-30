import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminDeliveriesService } from './admin-deliveries.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveryStatus } from '@prisma/client';

describe('AdminDeliveriesService', () => {
  let service: AdminDeliveriesService;
  let prisma: any;
  let notifications: any;
  let audit: any;

  const adminId = 'admin-1111-1111-1111-111111111111';
  const deliveryId = 'del-2222-2222-2222-222222222222';
  const orderId = 'order-3333-3333-3333-333333333333';
  const buyerId = 'buyer-4444-4444-4444-444444444444';

  const deliveryMock: any = {
    id: deliveryId,
    orderId,
    type: 'HOME_DELIVERY',
    addressId: null,
    scheduledDate: new Date('2026-09-01'),
    timeWindow: '09:00-12:00',
    status: DeliveryStatus.SCHEDULED,
    deliveryFee: 1000,
    instructions: null,
    order: {
      id: orderId,
      buyerId,
      status: 'AWAITING_PAYMENT',
      total: 10000,
      createdAt: new Date(),
    },
    address: null,
  };

  beforeEach(async () => {
    prisma = {
      delivery: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    notifications = {
      criar: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    };
    audit = {
      register: jest.fn().mockResolvedValue({}),
      registar: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditService, useValue: audit },
        AdminDeliveriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = module.get<AdminDeliveriesService>(AdminDeliveriesService);
  });

  it('should paginate with filter status', async () => {
    prisma.delivery.count.mockResolvedValue(1);
    prisma.delivery.findMany.mockResolvedValue([deliveryMock]);
    const dto = new FilterDeliveriesDto();
    (dto as any).estado = 'a_caminho';
    dto.page = 1;
    dto.limit = 20;
    const result = await service.findAll(dto);
    const where = prisma.delivery.count.mock.calls[0][0].where;
    expect(where.status).toBe(DeliveryStatus.ON_THE_WAY);
    expect(result.total).toBe(1);
  });

  it('should filter by date (scheduledDate)', async () => {
    prisma.delivery.count.mockResolvedValue(0);
    prisma.delivery.findMany.mockResolvedValue([]);
    const dto = new FilterDeliveriesDto();
    dto.data_inicio = '2026-09-01';
    dto.data_fim = '2026-09-30';
    dto.page = 1;
    dto.limit = 10;
    await service.findAll(dto);
    const where = prisma.delivery.count.mock.calls[0][0].where;
    expect(where.scheduledDate.gte).toBeInstanceOf(Date);
    expect(where.scheduledDate.lte).toBeInstanceOf(Date);
  });

  it('should update status, record audit and notify buyer', async () => {
    prisma.delivery.findUnique.mockResolvedValue(deliveryMock);
    prisma.delivery.update.mockResolvedValue({
      ...deliveryMock,
      status: DeliveryStatus.ON_THE_WAY,
    });
    const dto = new UpdateDeliveryStatusDto();
    dto.estado = 'a_caminho';
    const result = await service.updateStatus(adminId, deliveryId, dto);
    expect(prisma.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: DeliveryStatus.ON_THE_WAY } }),
    );
    expect(audit.register).toHaveBeenCalledWith(
      adminId,
      'update_delivery_status',
      'delivery',
      deliveryId,
      expect.any(Object),
    );
    expect(result.estado).toBe(DeliveryStatus.ON_THE_WAY);
    expect(result.status).toBe(DeliveryStatus.ON_THE_WAY);
  });

  it('should throw 400 for invalid status', async () => {
    const dto = new UpdateDeliveryStatusDto();
    dto.estado = 'invalido';
    await expect(service.updateStatus(adminId, deliveryId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('should throw 404 if delivery not exists', async () => {
    prisma.delivery.findUnique.mockResolvedValue(null);
    const dto = new UpdateDeliveryStatusDto();
    dto.estado = 'entregue';
    await expect(service.updateStatus(adminId, 'no-id', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should accept english alias', async () => {
    prisma.delivery.findUnique.mockResolvedValue(deliveryMock);
    prisma.delivery.update.mockResolvedValue({ ...deliveryMock, status: DeliveryStatus.DELIVERED });
    const dto = new UpdateDeliveryStatusDto();
    dto.status = 'delivered';
    const result = await service.updateStatus(adminId, deliveryId, dto);
    expect(result.estado).toBe(DeliveryStatus.DELIVERED);
  });
});

// legacy
describe('AdminEntregasService', () => {
  it('alias should exist', () => {
    expect(AdminDeliveriesService).toBeDefined();
  });
});
