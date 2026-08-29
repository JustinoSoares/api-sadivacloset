import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'log1' }), count: jest.fn(), findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditoriaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AuditoriaService>(AuditoriaService);
  });

  it('registar deve criar log com adminId, acao, entidade, entidadeId, detalhes', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log1', adminId: 'admin1', action: 'criar_produto', entity: 'produto', entityId: 'prod1' });
    const result = await service.registar('admin1', 'criar_produto', 'produto', 'prod1', { nome: 'Teste' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { adminId: 'admin1', action: 'criar_produto', entity: 'produto', entityId: 'prod1', details: { nome: 'Teste' } },
    });
    expect(result).toBeDefined();
  });

  it('register alias deve delegar para registar', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log2' });
    const result = await service.register('admin1', 'atualizar_pedido', 'pedido', 'order1', { de: 'pago' });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('listar deve paginar e filtrar por entidade e intervalo', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'log1', adminId: 'admin1', action: 'criar_produto', entity: 'produto', entityId: 'prod1', details: {}, createdAt: new Date() }]);
    const dto: any = { entidade: 'produto', data_inicio: '2026-01-01', data_fim: '2026-12-31', page: 1, limit: 20, skip: 0, take: 20 };
    const result = await service.listar(dto);
    expect(prisma.auditLog.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ entity: 'produto' }) }));
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});
