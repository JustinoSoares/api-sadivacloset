import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Categoria, EstadoProduto } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

function toArray<T>(value: unknown): T[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string' && value.includes(',')) {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean) as unknown as T[];
  }
  return [value as T];
}

export enum OrdenarProdutos {
  recentes = 'recentes',
  antigos = 'antigos',
  preco_asc = 'preco_asc',
  preco_desc = 'preco_desc',
  nome_asc = 'nome_asc',
  nome_desc = 'nome_desc',
}

export class FiltrarProdutosPublicDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Pesquisa em nome + descricao', example: 'vestido' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Categoria, isArray: true, description: 'Filtra por categorias' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsEnum(Categoria, {
    each: true,
    message: `categoria deve ser um dos valores: ${Object.values(Categoria).join(', ')}`,
  })
  categoria?: Categoria[];

  @ApiPropertyOptional({ isArray: true, example: ['M', 'L'], description: 'Filtra por tamanhos' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsString({ each: true })
  tamanho?: string[];

  @ApiPropertyOptional({ enum: EstadoProduto, isArray: true, description: 'Filtra por estados' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsEnum(EstadoProduto, {
    each: true,
    message: `estado deve ser: ${Object.values(EstadoProduto).join(', ')}`,
  })
  estado?: EstadoProduto[];

  @ApiPropertyOptional({ description: 'Preço mínimo com desconto aplicado', example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preco_min deve ser inteiro' })
  @Min(0, { message: 'preco_min deve ser >= 0' })
  preco_min?: number;

  @ApiPropertyOptional({ description: 'Preço máximo com desconto aplicado', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'preco_max deve ser inteiro' })
  @Min(0, { message: 'preco_max deve ser >= 0' })
  preco_max?: number;

  @ApiPropertyOptional({ enum: OrdenarProdutos, description: 'Ordenação' })
  @IsOptional()
  @IsEnum(OrdenarProdutos, {
    message: `ordenar deve ser: ${Object.values(OrdenarProdutos).join(', ')}`,
  })
  ordenar?: OrdenarProdutos;
}
