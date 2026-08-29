import { Test, TestingModule } from '@nestjs/testing';
import { AdminMembrosService } from './admin-membros.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { Role, OrderStatus } from '@prisma/client';

describe('AdminMembrosService', () => {
  let service: AdminMembrosService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      order: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminMembrosService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminMembrosService>(AdminMembrosService);
  });

  it('deve listar membros paginados com pesquisa por nome/email e agregação real por comprador_id', async () => {
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Joao Silva', email: 'joao@test.com', createdAt: new Date(), isActive: true, role: Role.BUYER },
      { id: 'u2', name: 'Maria', email: 'maria@test.com', createdAt: new Date(), isActive: true, role: Role.BUYER },
    ]);
    prisma.order.groupBy
      .mockResolvedValueOnce([
        { buyerId: 'u1', _count: { _all: 3 }, _sum: { total: 15000 } },
        { buyerId: 'u2', _count: { _all: 1 }, _sum: { total: 5000 } },
      ])
      .mockResolvedValueOnce([
        { buyerId: 'u1', _count: { _all: 2 }, _sum: { total: 10000 } },
        { buyerId: 'u2', _count: { _all: 1 }, _sum: { total: 5000 } },
      ]);

    const dto = new FilterMembrosDto();
    dto.q = 'joao';
    dto.page = 1;
    dto.limit = 20;
    const result = await service.findAll(dto);

    expect(prisma.user.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: Role.BUYER }) }));
    // verifica OR com nome/email
    const where = prisma.user.count.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe('u1');
    expect(result.data[0].totalPedidos).toBe(3);
    expect(result.data[0].totalGasto).toBe(10000); // soma pago/concluido
    expect(result.data[0].totalGastoBruto).toBe(15000);
  });

  it('não deve comparar por nome – sempre por comprador_id', async () => {
    // Gera dois users com mesmo nome mas ids diferentes
    prisma.user.count.mockResolvedValue(2);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'João', email: 'joao1@test.com', createdAt: new Date(), isActive: true, role: Role.BUYER },
      { id: 'u2', name: 'João', email: 'joao2@test.com', createdAt: new Date(), isActive: true, role: Role.BUYER },
    ]);
    prisma.order.groupBy
      .mockResolvedValueOnce([
        { buyerId: 'u1', _count: { _all: 5 }, _sum: { total: 50000 } },
        { buyerId: 'u2', _count: { _all: 1 }, _sum: { total: 1000 } },
      ])
      .mockResolvedValueOnce([
        { buyerId: 'u1', _count: { _all: 3 }, _sum: { total: 30000 } },
        { buyerId: 'u2', _count: { _all: 0 }, _sum: { total: 0 } },
      ]);
    const dto = new FilterMembrosDto();
    const result = await service.findAll(dto);
    // cada membro deve ter agregação distinta, não misturada por nome
    const m1 = result.data.find((m: any) => m.id === 'u1');
    const m2 = result.data.find((m: any) => m.id === 'u2');
    expect(m1.totalPedidos).toBe(5);
    expect(m2.totalPedidos).toBe(1);
    expect(m1.totalGasto).not.toBe(m2.totalGasto);
  });

  it('deve retornar histórico de pedidos do membro paginado', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.BUYER });
    prisma.order.count.mockResolvedValue(2);
    prisma.order.findMany.mockResolvedValue([
      { id: 'o1', buyerId: 'u1', total: 5000, status: OrderStatus.PAID, createdAt: new Date(), items: [], delivery: null, payment: null },
    ]);
    const dto: any = { page: 1, limit: 10, skip: 0, take: 10 };
    const result = await service.findPedidosByMembro('u1', dto);
    expect(prisma.order.count).toHaveBeenCalledWith({ where: { buyerId: 'u1' } });
    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { buyerId: 'u1' } }));
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe('o1');
  });

  it('deve dar 404 se membro não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findPedidosByMembro('fake-id', { page: 1, limit: 10, skip: 0, take: 10 } as any)).rejects.toThrow();
  });
});
