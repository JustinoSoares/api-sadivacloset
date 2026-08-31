import { Test, TestingModule } from '@nestjs/testing';
import { AdminEstatisticasService } from './admin-estatisticas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';

describe('AdminEstatisticasService', () => {
  let service: AdminEstatisticasService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      product: { count: jest.fn() },
      user: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminEstatisticasService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AdminEstatisticasService>(AdminEstatisticasService);
  });

  it('should calcular receita total, contagens e variação 30d vs 30d anteriores', async () => {
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { total: 100000 } }) // total
      .mockResolvedValueOnce({ _sum: { total: 30000 } }) // atual
      .mockResolvedValueOnce({ _sum: { total: 20000 } }); // anterior
    prisma.product.count
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(10) // atual
      .mockResolvedValueOnce(5); // anterior
    prisma.user.count
      .mockResolvedValueOnce(100) // total membros
      .mockResolvedValueOnce(20) // atual
      .mockResolvedValueOnce(10); // anterior
    prisma.order.count
      .mockResolvedValueOnce(80) // total pedidos
      .mockResolvedValueOnce(15) // atual
      .mockResolvedValueOnce(10) // anterior
      .mockResolvedValueOnce(80); // pedidosRecentes total
    prisma.order.findMany.mockResolvedValue([]);

    const dto = new QueryEstatisticasDto();
    dto.dias = 30;
    dto.page = 1;
    dto.limit = 20;
    const result = await service.getEstatisticas(dto);

    expect(result.totalRevenue).toBe(100000);
    expect(result.revenue.value).toBe(30000);
    expect(result.revenue.previousValue).toBe(20000);
    expect(result.revenue.percentage).toBe(50); // (30000-20000)/20000*100=50
    expect(result.revenue.grew).toBe(true);

    expect(result.totalProducts).toBe(50);
    expect(result.products.percentage).toBe(100); // (10-5)/5*100

    expect(result.totalMembers).toBe(100);
    expect(result.members.percentage).toBe(100);

    expect(result.totalOrders).toBe(80);
    expect(result.orders.percentage).toBe(50);

    expect(result.period.days).toBe(30);
    expect(result.recentOrders).toBeDefined();
  });

  it('deve tratar anterior 0 como 100% se atual >0', async () => {
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { total: 50000 } })
      .mockResolvedValueOnce({ _sum: { total: 10000 } })
      .mockResolvedValueOnce({ _sum: { total: 0 } });
    prisma.product.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    prisma.order.count.mockResolvedValue(0);
    prisma.order.findMany.mockResolvedValue([]);

    const dto2 = new QueryEstatisticasDto();
    dto2.dias = 7;
    const result2 = await service.getEstatisticas(dto2);
    expect(result2.revenue.percentage).toBe(100);
    expect(result2.revenue.grew).toBe(true);
  });

  it('deve suportar intervalo custom data_inicio/data_fim', async () => {
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 0 } });
    prisma.product.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    prisma.order.count.mockResolvedValue(0);
    prisma.order.findMany.mockResolvedValue([]);

    const dto = new QueryEstatisticasDto();
    dto.data_inicio = '2026-07-01';
    dto.data_fim = '2026-07-31';
    dto.page = 1;
    dto.limit = 10;
    const result = await service.getEstatisticas(dto);
    expect(result.period.start.toISOString().startsWith('2026-07-01')).toBe(true);
    expect(result.period.end.toISOString().startsWith('2026-07-31')).toBe(true);
    // período anterior deve ter mesma duração
    const durAtual = result.period.end.getTime() - result.period.start.getTime();
    const durAnterior =
      result.period.previousEnd.getTime() - result.period.previousStart.getTime();
    expect(Math.abs(durAtual - durAnterior)).toBeLessThan(2000);
  });

  it('deve paginar pedidosRecentes via page/limit', async () => {
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 0 } });
    prisma.product.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(0);
    prisma.order.count
      .mockResolvedValueOnce(0) // totalPedidos
      .mockResolvedValueOnce(0) // pedidosAtual
      .mockResolvedValueOnce(0) // pedidosAnterior
      .mockResolvedValueOnce(5); // pedidosRecentes total
    prisma.order.findMany.mockResolvedValue([{ id: '1' } as any]);
    const dto = new QueryEstatisticasDto();
    dto.page = 2;
    dto.limit = 2;
    const result = await service.getEstatisticas(dto);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
    expect(result.recentOrders.page).toBe(2);
    expect(result.recentOrders.total).toBe(5);
  });
});
