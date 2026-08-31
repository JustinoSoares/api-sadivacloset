import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Category } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

function mapCategory(value: any): Category | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).toLowerCase();
  const map: Record<string, Category> = {
    fatos: Category.SUITS,
    suits: Category.SUITS,
    camisas: Category.SHIRTS,
    shirts: Category.SHIRTS,
    vestidos: Category.DRESSES,
    dresses: Category.DRESSES,
    outros: Category.OTHERS,
    others: Category.OTHERS,
  };
  return (map[str] as Category) ?? value;
}

export class FilterProductsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name (q)', example: 'dress' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Category, description: 'Filter by category' })
  @Transform(({ obj }) => mapCategory(obj.category ?? obj.categoria))
  @IsOptional()
  @IsEnum(Category, { message: `category must be one of: ${Object.values(Category).join(', ')}` })
  category?: Category;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => mapCategory(value))
  @IsEnum(Category)
  categoria?: Category;
}

export class FiltrarProdutosDto extends FilterProductsDto {}
