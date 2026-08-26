import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO base para paginação clássica ?page=&limit=
 * Used in all listable endpoints, including /admin/products.
 */
export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, description: 'Items per page' })
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

// ── Legacy format (compatibility) ─────────────────────────────────
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

// ── Bilingual format: English + Portuguese (code English, messages Portuguese) ─────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  dados: T[];
  page: number;
  pagina: number;
  total: number;
  totalPages: number;
  total_paginas: number;
}

export function buildPaginatedResponse<T>(
  dados: T[],
  total: number,
  dto: PaginationDto,
): PaginatedResponse<T> {
  const pagina = dto.page ?? 1;
  const page = pagina;
  const limit = dto.limit ?? 20;
  const totalPages = Math.ceil(total / limit);
  const total_paginas = totalPages;
  return {
    data: dados,
    dados,
    page,
    pagina,
    total,
    totalPages,
    total_paginas,
  };
}

// Alias for reusable helper
export const paginate = buildPaginatedResponse;
export const paginar = buildPaginatedResponse;
