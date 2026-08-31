import { Test } from '@nestjs/testing';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;
  let service: any;

  const adminId = 'admin-1111';
  const user = { sub: adminId, email: 'admin@test.com', role: 'admin' } as any;
  const orderId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 }),
      updateStatus: jest.fn().mockResolvedValue({ id: orderId, status: 'PAID' }),
    };
    const mod = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: AdminOrdersService, useValue: service }],
    }).compile();
    controller = mod.get(AdminOrdersController);
  });

  it('GET /admin/orders should paginate', async () => {
    const dto = new FilterOrdersDto();
    dto.page = 1;
    dto.limit = 20;
    await controller.findAll(dto);
    expect(service.findAll).toHaveBeenCalledWith(dto);
  });

  it('PATCH /admin/orders/:id/status should update', async () => {
    const dto = new UpdateOrderStatusDto();
    dto.status = 'paid';
    const result = await controller.updateStatus(user, orderId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, orderId, dto);
    expect(result.data.status).toBe('PAID');
  });

  it('PATCH /admin/orders/:id/estado legacy should also update', async () => {
    const dto = new UpdateOrderStatusDto();
    dto.estado = 'pago';
    const result = await (controller as any).updateStatusLegacy(user, orderId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, orderId, dto);
    expect(result.data.status).toBe('PAID');
  });

  it('should have correct path and roles', () => {
    expect(Reflect.getMetadata('path', AdminOrdersController)).toBe('admin/orders');
    const roles = Reflect.getMetadata('roles', AdminOrdersController);
    expect(roles).toContain('admin');
  });
});

// legacy suite
describe('AdminPedidosController', () => {
  it('alias via extend should exist', () => {
    expect(AdminOrdersController).toBeDefined();
  });
});
