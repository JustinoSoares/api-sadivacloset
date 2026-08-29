import { Test } from '@nestjs/testing';
import { AdminEntregasController } from './admin-deliveries.controller';
import { AdminDeliveriesService } from './admin-deliveries.service';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

describe('AdminEntregasController', () => {
  let controller: AdminEntregasController;
  let service: any;

  const adminId = 'admin-1111';
  const user = { sub: adminId, email: 'admin@test.com', role: 'admin' } as any;
  const deliveryId = 'del-2222-2222-2222-222222222222';

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ data: [], dados: [], total: 0, pagina: 1, page: 1 }),
      updateStatus: jest.fn().mockResolvedValue({ id: deliveryId, estado: 'a_caminho' }),
    };
    const mod = await Test.createTestingModule({
      controllers: [AdminEntregasController],
      providers: [{ provide: AdminDeliveriesService, useValue: service }],
    }).compile();
    controller = mod.get(AdminEntregasController);
  });

  it('GET /admin/entregas should paginate with filters', async () => {
    const dto = new FilterDeliveriesDto();
    dto.page = 1;
    dto.limit = 20;
    (dto as any).estado = 'agendada';
    await controller.findAll(dto);
    expect(service.findAll).toHaveBeenCalledWith(dto);
  });

  it('PATCH /admin/entregas/:id/estado should update', async () => {
    const dto = new UpdateDeliveryStatusDto();
    dto.estado = 'a_caminho';
    const result = await controller.updateStatus(user, deliveryId, dto);
    expect(service.updateStatus).toHaveBeenCalledWith(adminId, deliveryId, dto);
    expect(result.data.estado).toBe('a_caminho');
  });

  it('should have correct path and roles', () => {
    expect(Reflect.getMetadata('path', AdminEntregasController)).toBe('admin/entregas');
    const roles = Reflect.getMetadata('roles', AdminEntregasController);
    expect(roles).toContain('admin');
  });
});
