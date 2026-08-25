import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Produto } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { FiltrarProdutosDto } from './dto/filtrar-produtos.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../../common/dto/pagination.dto';

@Injectable()
export class ProdutosAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: FiltrarProdutosDto): Promise<PaginatedResponse<Produto>> {
    const where: Prisma.ProdutoWhereInput = {};

    if (query.q) {
      where.nomeProduto = {
        contains: query.q,
        mode: 'insensitive' as const,
      };
    }

    if (query.categoria) {
      where.categoria = query.categoria;
    }

    const [total, dados] = await Promise.all([
      this.prisma.produto.count({ where }),
      this.prisma.produto.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { criadoEm: 'desc' },
      }),
    ]);

    return buildPaginatedResponse(dados, total, query);
  }

  async create(dto: CreateProdutoDto): Promise<Produto> {
    return this.prisma.produto.create({
      data: {
        imagem: dto.imagem,
        nomeProduto: dto.nomeProduto,
        descricao: dto.descricao,
        categoria: dto.categoria,
        tamanho: dto.tamanho,
        estado: dto.estado,
        volume: dto.volume,
        price: dto.price,
        desconto: dto.desconto ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateProdutoDto): Promise<Produto> {
    const exists = await this.prisma.produto.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    return this.prisma.produto.update({
      where: { id },
      data: {
        ...(dto.imagem !== undefined ? { imagem: dto.imagem } : {}),
        ...(dto.nomeProduto !== undefined ? { nomeProduto: dto.nomeProduto } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.tamanho !== undefined ? { tamanho: dto.tamanho } : {}),
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.volume !== undefined ? { volume: dto.volume } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.desconto !== undefined ? { desconto: dto.desconto } : {}),
      },
    });
  }

  async remove(id: string): Promise<{ mensagem: string }> {
    const exists = await this.prisma.produto.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Produto não encontrado' },
      });
    }

    await this.prisma.produto.delete({ where: { id } });
    return { mensagem: 'Produto removido com sucesso' };
  }
}
