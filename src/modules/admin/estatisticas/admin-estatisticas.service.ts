import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';
import { buildPaginatedResponse } from '../../../common/dto/pagination.dto';

function calcVariacao(
  atual: number,
  anterior: number,
): { percentual: number | null; crescimento: boolean | null; diferenca: number } {
  const diferenca = atual - anterior;
  if (anterior === 0) {
    if (atual === 0) return { percentual: 0, crescimento: null, diferenca: 0 };
    return { percentual: 100, crescimento: true, diferenca };
  }
  const percentual = Number(((diferenca / anterior) * 100).toFixed(1));
  return {
    percentual,
    crescimento: diferenca > 0 ? true : diferenca < 0 ? false : null,
    diferenca,
  };
}

function metric(valorAtual: number, valorAnterior: number, valorTotal?: number) {
  const v = calcVariacao(valorAtual, valorAnterior);
  return {
    valor: valorAtual,
    valorAnterior,
    valorTotal,
    diferenca: v.diferenca,
    percentual: v.percentual,
    crescimento: v.crescimento,
    // alias bilíngue
    value: valorAtual,
    previousValue: valorAnterior,
    totalValue: valorTotal,
    percentage: v.percentual,
    grew: v.crescimento,
  };
}

@Injectable()
export class AdminEstatisticasService {
  constructor(private readonly prisma: PrismaService) {}

  async getEstatisticas(dto: QueryEstatisticasDto) {
    const dias = dto.diasNormalized;
    const now = new Date();

    let inicioAtual: Date;
    let fimAtual: Date;
    let inicioAnterior: Date;
    let fimAnterior: Date;

    const inicioStr = dto.inicioNormalized;
    const fimStr = dto.fimNormalized;

    if (inicioStr && fimStr) {
      inicioAtual = new Date(inicioStr);
      fimAtual = new Date(fimStr);
      // normaliza fim para fim do dia
      fimAtual.setHours(23, 59, 59, 999);
      const durMs = fimAtual.getTime() - inicioAtual.getTime();
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - durMs);
    } else if (inicioStr && !fimStr) {
      inicioAtual = new Date(inicioStr);
      fimAtual = new Date(inicioAtual.getTime() + dias * 24 * 60 * 60 * 1000);
      fimAtual.setHours(23, 59, 59, 999);
      const durMs = fimAtual.getTime() - inicioAtual.getTime();
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - durMs);
    } else {
      fimAtual = now;
      inicioAtual = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
      fimAnterior = new Date(inicioAtual.getTime() - 1);
      inicioAnterior = new Date(fimAnterior.getTime() - dias * 24 * 60 * 60 * 1000);
    }

    const receitaWhere = { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } };

    const [
      receitaTotalAgg,
      receitaAtualAgg,
      receitaAnteriorAgg,
      totalProdutos,
      produtosAtual,
      produtosAnterior,
      totalMembros,
      membrosAtual,
      membrosAnterior,
      totalPedidos,
      pedidosAtual,
      pedidosAnterior,
    ] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { total: true }, where: receitaWhere }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...receitaWhere, createdAt: { gte: inicioAtual, lte: fimAtual } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...receitaWhere, createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { createdAt: { gte: inicioAtual, lte: fimAtual } } }),
      this.prisma.product.count({
        where: { createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.user.count({ where: { role: Role.BUYER } }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: inicioAtual, lte: fimAtual } },
      }),
      this.prisma.user.count({
        where: { role: Role.BUYER, createdAt: { gte: inicioAnterior, lte: fimAnterior } },
      }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: inicioAtual, lte: fimAtual } } }),
      this.prisma.order.count({ where: { createdAt: { gte: inicioAnterior, lte: fimAnterior } } }),
    ]);

    const receitaTotal = receitaTotalAgg._sum.total ?? 0;
    const receitaAtual = receitaAtualAgg._sum.total ?? 0;
    const receitaAnterior = receitaAnteriorAgg._sum.total ?? 0;

    const receita = {
      total: receitaTotal,
      periodoAtual: receitaAtual,
      periodoAnterior: receitaAnterior,
      ...calcVariacao(receitaAtual, receitaAnterior),
      // bilíngue
      receita_total: receitaTotal,
      receita_periodo_atual: receitaAtual,
      receita_periodo_anterior: receitaAnterior,
    };

    // Para listagem paginada – pedidos recentes dentro do período atual
    const wherePedidosRecentes: any = {};
    // se quiser apenas do período atual, filtrar; senão todos
    // mantemos todos para listagem geral paginada, mas com filtro opcional de período
    const [totalRecentes, pedidosRecentes] = await Promise.all([
      this.prisma.order.count({ where: wherePedidosRecentes }),
      this.prisma.order.findMany({
        where: wherePedidosRecentes,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          items: true,
          delivery: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const pedidosPaginados = buildPaginatedResponse(pedidosRecentes, totalRecentes, dto);

    return {
      // agregados totais
      receita_total: receitaTotal,
      receitaTotal,
      receita: metric(receitaAtual, receitaAnterior, receitaTotal),
      // alias compatível com spec anterior
      receitaTotalVariacao: calcVariacao(receitaAtual, receitaAnterior),

      total_produtos: totalProdutos,
      totalProdutos,
      produtos: metric(produtosAtual, produtosAnterior, totalProdutos),

      total_membros: totalMembros,
      totalMembros,
      membros: metric(membrosAtual, membrosAnterior, totalMembros),
      nMembros: totalMembros,
      n_membros: totalMembros,

      total_pedidos: totalPedidos,
      totalPedidos,
      pedidos: metric(pedidosAtual, pedidosAnterior, totalPedidos),
      nPedidos: totalPedidos,
      n_pedidos: totalPedidos,

      // detalhe período
      periodo: {
        dias,
        inicio: inicioAtual,
        fim: fimAtual,
        inicioAnterior,
        fimAnterior,
        // iso strings for frontend
        inicio_iso: inicioAtual.toISOString(),
        fim_iso: fimAtual.toISOString(),
        inicioAnterior_iso: inicioAnterior.toISOString(),
        fimAnterior_iso: fimAnterior.toISOString(),
      },
      period: {
        days: dias,
        start: inicioAtual,
        end: fimAtual,
        previousStart: inicioAnterior,
        previousEnd: fimAnterior,
      },

      // variação geral (atalho)
      variacao: {
        receita: calcVariacao(receitaAtual, receitaAnterior),
        produtos: calcVariacao(produtosAtual, produtosAnterior),
        membros: calcVariacao(membrosAtual, membrosAnterior),
        pedidos: calcVariacao(pedidosAtual, pedidosAnterior),
      },

      // listagem paginada (exigida: "listagem com paginação e tudo mais")
      pedidosRecentes: pedidosPaginados,
      pedidos_recentes: pedidosPaginados,
      // para compatibilidade com padrão {data,dados}
      data: pedidosPaginados.data,
      dados: pedidosPaginados.dados,
      page: pedidosPaginados.page,
      pagina: pedidosPaginados.pagina,
      total: pedidosPaginados.total,
      totalPages: pedidosPaginados.totalPages,
      total_paginas: pedidosPaginados.total_paginas,
    };
  }
}
