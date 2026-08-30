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

    expect(result.receita_total).toBe(100000);
    expect(result.receitaTotal).toBe(100000);
    expect(result.receita.valor).toBe(30000);
    expect(result.receita.valorAnterior).toBe(20000);
    expect(result.receita.percentual).toBe(50); // (30000-20000)/20000*100=50
    expect(result.receita.crescimento).toBe(true);

    expect(result.total_produtos).toBe(50);
    expect(result.produtos.percentual).toBe(100); // (10-5)/5*100

    expect(result.total_membros).toBe(100);
    expect(result.membros.percentual).toBe(100);

    expect(result.total_pedidos).toBe(80);
    expect(result.pedidos.percentual).toBe(50);

    expect(result.periodo.dias).toBe(30);
    expect(result.pedidosRecentes).toBeDefined();
    expect(result.data).toEqual([]);
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
    expect(result2.receita.percentual).toBe(100);
    expect(result2.receita.crescimento).toBe(true);
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
    expect(result.periodo.inicio.toISOString().startsWith('2026-07-01')).toBe(true);
    expect(result.periodo.fim.toISOString().startsWith('2026-07-31')).toBe(true);
    // período anterior deve ter mesma duração
    const durAtual = result.periodo.fim.getTime() - result.periodo.inicio.getTime();
    const durAnterior =
      result.periodo.fimAnterior.getTime() - result.periodo.inicioAnterior.getTime();
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
    expect(result.pedidosRecentes.page).toBe(2);
    expect(result.pedidosRecentes.total).toBe(5);
  });
});
