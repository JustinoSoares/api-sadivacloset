import { Test } from '@nestjs/testing';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaController', () => {
  let controller: AuditoriaController;
  let service: any;

  beforeEach(async () => {
    service = {
      listar: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 1 }),
    };
    const mod = await Test.createTestingModule({
      controllers: [AuditoriaController],
      providers: [{ provide: AuditoriaService, useValue: service }],
    }).compile();
    controller = mod.get(AuditoriaController);
  });

  it('GET /admin/auditoria deve listar paginado com filtros', async () => {
    const dto: any = { entidade: 'produto', page: 1, limit: 20 };
    const result = await controller.listar(dto);
    expect(service.listar).toHaveBeenCalledWith(dto);
    expect(result.total).toBe(0);
  });

  it('deve ter path correto e role admin', () => {
    expect(Reflect.getMetadata('path', AuditoriaController)).toBe('admin/auditoria');
    const roles = Reflect.getMetadata('roles', AuditoriaController);
    expect(roles).toContain('admin');
  });
});
