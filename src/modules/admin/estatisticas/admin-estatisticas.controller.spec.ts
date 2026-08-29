import { Test } from '@nestjs/testing';
import { AdminEstatisticasController } from './admin-estatisticas.controller';
import { AdminEstatisticasService } from './admin-estatisticas.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';

describe('AdminEstatisticasController', () => {
  let controller: AdminEstatisticasController;
  let service: any;

  beforeEach(async () => {
    service = { getEstatisticas: jest.fn().mockResolvedValue({ receita_total: 100000, total_produtos: 50 }) };
    const mod = await Test.createTestingModule({
      controllers: [AdminEstatisticasController],
      providers: [{ provide: AdminEstatisticasService, useValue: service }],
    }).compile();
    controller = mod.get(AdminEstatisticasController);
  });

  it('GET /admin/estatisticas deve chamar service com query e retornar {data,dados}', async () => {
    const dto = new QueryEstatisticasDto();
    dto.dias = 30;
    dto.page = 1;
    dto.limit = 20;
    const result = await controller.getEstatisticas(dto);
    expect(service.getEstatisticas).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ data: expect.any(Object), dados: expect.any(Object) });
  });

  it('deve suportar dias parametrizável e paginação', async () => {
    const dto = new QueryEstatisticasDto();
    dto.dias = 7;
    dto.page = 2;
    dto.limit = 5;
    await controller.getEstatisticas(dto);
    expect(service.getEstatisticas).toHaveBeenCalledWith(dto);
  });

  it('deve ter path correto e role admin', () => {
    expect(Reflect.getMetadata('path', AdminEstatisticasController)).toBe('admin/estatisticas');
    const roles = Reflect.getMetadata('roles', AdminEstatisticasController);
    expect(roles).toContain('admin');
  });
});
