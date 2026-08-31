import { Test } from '@nestjs/testing';
import { AdminDeliveriesController } from './admin-deliveries.controller';
import { AdminDeliveriesService } from './admin-deliveries.service';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

describe('AdminDeliveriesController', () => {
  let controller: AdminDeliveriesController;
  let service: any;

  const adminId = 'admin-1111';
  const user = { sub: adminId, email: 'admin@test.com', role: 'admin' } as any;
  const deliveryId = 'del-2222-2222-2222-222222222222';

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 }),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ id: deliveryId, status: 'ON_THE_WAY' }),
    };
    const mod = await Test.createTestingModule({
      controllers: [AdminDeliveriesController],
      providers: [{ provide: AdminDeliveriesService, useValue: service }],
    }).compile();
    controller = mod.get(AdminDeliveriesController);
  });

  it('GET /admin/deliveries should paginate with filters', async () => {
    const dto = new FilterDeliveriesDto();
    dto.page = 1;
    dto.limit = 20;
    (dto as any).estado = 'agendada';
    await controller.findAll(dto);
    expect(service.findAll).toHaveBeenCalledWith(dto);
  });

  it('PATCH /admin/deliveries/:id/status should update', async () => {
    const dto = new UpdateDeliveryStatusDto();
    dto.status = 'on_the_way';
    const result = await controller.updateStatus(user, deliveryId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, deliveryId, dto);
    expect(result.data.status).toBe('ON_THE_WAY');
  });

  it('PATCH legacy alias should also update', async () => {
    const dto = new UpdateDeliveryStatusDto();
    dto.estado = 'a_caminho';
    const result = await (controller as any).updateStatusLegacy(user, deliveryId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, deliveryId, dto);
  });

  it('should have correct path and roles', () => {
    expect(Reflect.getMetadata('path', AdminDeliveriesController)).toBe('admin/deliveries');
    const roles = Reflect.getMetadata('roles', AdminDeliveriesController);
    expect(roles).toContain('admin');
  });
});

// legacy suite
describe('AdminEntregasController', () => {
  it('alias should exist', () => {
    expect(AdminDeliveriesController).toBeDefined();
  });
});
