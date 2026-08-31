import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  productId?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  product_id?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  produto_id?: string;

  @ApiPropertyOptional({ description: 'Quantity', example: 2, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity?: number;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantidade?: number;

  get productIdNormalized(): string | undefined {
    return this.productId ?? this.product_id ?? this.produto_id;
  }

  get quantityNormalized(): number | undefined {
    return this.quantity ?? this.quantidade;
  }
}

export class UpdateCartItemDto {
  @ApiPropertyOptional({ description: 'Quantity', example: 3, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity?: number;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantidade?: number;

  get quantityNormalized(): number | undefined {
    return this.quantity ?? this.quantidade;
  }
}
