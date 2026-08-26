import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Category, ProductCondition } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

function toArray<T>(value: unknown): T[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string' && value.includes(',')) {
    return value.split(',').map((v) => v.trim()).filter(Boolean) as unknown as T[];
  }
  return [value as T];
}

function mapCategoryArray(value: unknown): Category[] | undefined {
  const arr = toArray<string>(value);
  if (!arr) return undefined;
  const map: Record<string, Category> = {
    fatos: Category.SUITS,
    suits: Category.SUITS,
    camisas: Category.SHIRTS,
    shirts: Category.SHIRTS,
    vestidos: Category.DRESSES,
    dresses: Category.DRESSES,
    outros: Category.OTHERS,
    others: Category.OTHERS,
    SUITS: Category.SUITS,
    SHIRTS: Category.SHIRTS,
    DRESSES: Category.DRESSES,
    OTHERS: Category.OTHERS,
  };
  return arr.map((v) => map[v.toLowerCase()] ?? (v as Category));
}

function mapConditionArray(value: unknown): ProductCondition[] | undefined {
  const arr = toArray<string>(value);
  if (!arr) return undefined;
  const map: Record<string, ProductCondition> = {
    novo: ProductCondition.NEW,
    new: ProductCondition.NEW,
    brand_new: ProductCondition.NEW,
    semi_novo: ProductCondition.PRE_OWNED,
    second_hand: ProductCondition.PRE_OWNED,
    pre_owned: ProductCondition.PRE_OWNED,
  };
  return arr.map((v) => map[v.toLowerCase()] ?? (v as ProductCondition));
}

export enum SortOrder {
  recent = 'recent',
  oldest = 'oldest',
  price_asc = 'price_asc',
  price_desc = 'price_desc',
  name_asc = 'name_asc',
  name_desc = 'name_desc',
  // legacy aliases
  recentes = 'recentes',
  antigos = 'antigos',
}

export class FilterProductsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search in name + description', example: 'dress' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Category, isArray: true, description: 'Filter by categories' })
  @IsOptional()
  @Transform(({ value }) => mapCategoryArray(value))
  @IsEnum(Category, { each: true, message: `category must be one of: ${Object.values(Category).join(', ')}` })
  category?: Category[];

  // legacy alias: categoria
  @IsOptional()
  @Transform(({ value }) => mapCategoryArray(value))
  @IsEnum(Category, { each: true })
  categoria?: Category[];

  @ApiPropertyOptional({ isArray: true, example: ['M', 'L'], description: 'Filter by sizes' })
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsString({ each: true })
  size?: string[];

  // legacy alias
  @IsOptional()
  @Transform(({ value }) => toArray<string>(value))
  @IsString({ each: true })
  tamanho?: string[];

  @ApiPropertyOptional({ enum: ProductCondition, isArray: true, description: 'Filter by condition' })
  @IsOptional()
  @Transform(({ value }) => mapConditionArray(value))
  @IsEnum(ProductCondition, { each: true, message: `condition must be: ${Object.values(ProductCondition).join(', ')}` })
  condition?: ProductCondition[];

  // legacy alias
  @IsOptional()
  @Transform(({ value }) => mapConditionArray(value))
  @IsEnum(ProductCondition, { each: true })
  estado?: ProductCondition[];

  @ApiPropertyOptional({ description: 'Min price with discount', example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price_min must be integer' })
  @Min(0, { message: 'price_min must be >= 0' })
  price_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  preco_min?: number;

  @ApiPropertyOptional({ description: 'Max price with discount', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'price_max must be integer' })
  @Min(0, { message: 'price_max must be >= 0' })
  price_max?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  preco_max?: number;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Sorting' })
  @IsOptional()
  @IsEnum(SortOrder, { message: `sort must be: ${Object.values(SortOrder).join(', ')}` })
  sort?: SortOrder;

  // legacy alias
  @IsOptional()
  @IsEnum(SortOrder)
  ordenar?: SortOrder;

  get normalizedCategory(): Category[] | undefined {
    return this.category ?? this.categoria;
  }
  get normalizedSize(): string[] | undefined {
    return this.size ?? this.tamanho;
  }
  get normalizedCondition(): ProductCondition[] | undefined {
    return this.condition ?? this.estado;
  }
  get normalizedPriceMin(): number | undefined {
    return this.price_min ?? this.preco_min;
  }
  get normalizedPriceMax(): number | undefined {
    return this.price_max ?? this.preco_max;
  }
  get normalizedSort(): SortOrder | undefined {
    return this.sort ?? this.ordenar;
  }
}

// keep legacy class name alias
export class FiltrarProdutosPublicDto extends FilterProductsDto {}
export enum OrdenarProdutos {
  recentes = 'recentes',
  antigos = 'antigos',
  preco_asc = 'preco_asc',
  preco_desc = 'preco_desc',
  nome_asc = 'nome_asc',
  nome_desc = 'nome_desc',
}
