import { Test } from '@nestjs/testing';
import { AdminPedidosController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

describe('AdminPedidosController', () => {
  let controller: AdminPedidosController;
  let service: any;

  const adminId = 'admin-1111';
  const user = { sub: adminId, email: 'admin@test.com', role: 'admin' } as any;
  const orderId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], dados: [], total: 0, pagina: 1, page: 1 }),
      updateStatus: jest.fn().mockResolvedValue({ id: orderId, estado: 'pago' }),
    };
    const mod = await Test.createTestingModule({
      controllers: [AdminPedidosController],
      providers: [{ provide: AdminOrdersService, useValue: service }],
    }).compile();
    controller = mod.get(AdminPedidosController);
  });

  it('GET /admin/pedidos should paginate', async () => {
    const dto = new FilterOrdersDto();
    dto.page = 1;
    dto.limit = 20;
    await controller.findAll(dto);
    expect(service.findAll).toHaveBeenCalledWith(dto);
  });

  it('PATCH /admin/pedidos/:id/estado should update', async () => {
    const dto = new UpdateOrderStatusDto();
    dto.estado = 'pago';
    const result = await controller.updateStatus(user, orderId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, orderId, dto);
    expect(result.data.estado).toBe('pago');
  });

  it('should have correct path and roles', () => {
    expect(Reflect.getMetadata('path', AdminPedidosController)).toBe('admin/pedidos');
    const roles = Reflect.getMetadata('roles', AdminPedidosController);
    expect(roles).toContain('admin');
  });
});
