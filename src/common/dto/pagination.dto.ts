import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO base para paginação clássica ?page=&limit=
 * Usado em todos os endpoints listáveis, incluindo /admin/produtos.
 * O frontend consome páginas sucessivas para implementar scroll infinito.
 */
export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Número da página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, description: 'Itens por página' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 20);
  }

  get take(): number {
    return this.limit ?? 20;
  }
}

// ── Formato legado (compatibilidade) ─────────────────────────────────
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  dto: PaginationDto,
): PaginatedResult<T> {
  const page = dto.page ?? 1;
  const limit = dto.limit ?? 20;
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Formato novo exigido pela task transversal ─────────────────────────
// Recebe page e limit da query, devolve { dados, pagina, total, total_paginas }
export interface PaginatedResponse<T> {
  dados: T[];
  pagina: number;
  total: number;
  total_paginas: number;
}

export function buildPaginatedResponse<T>(
  dados: T[],
  total: number,
  dto: PaginationDto,
): PaginatedResponse<T> {
  const pagina = dto.page ?? 1;
  const limit = dto.limit ?? 20;
  return {
    dados,
    pagina,
    total,
    total_paginas: Math.ceil(total / limit),
  };
}

// Alias para helper reutilizável — nome solicitado na task
export const paginate = buildPaginatedResponse;
export const paginar = buildPaginatedResponse;
