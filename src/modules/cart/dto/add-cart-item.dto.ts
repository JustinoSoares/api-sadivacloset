import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID('4', { message: 'produto_id deve ser um UUID válido' })
  produto_id?: string;

  @ApiPropertyOptional({ description: 'Alias English - Product ID' })
  @IsOptional()
  @IsUUID('4', { message: 'product_id deve ser um UUID válido' })
  product_id?: string;

  @ApiPropertyOptional({ description: 'Alias productId camelCase' })
  @IsOptional()
  @IsUUID('4', { message: 'productId deve ser um UUID válido' })
  productId?: string;

  @ApiProperty({ description: 'Quantidade', example: 2, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantidade deve ser um número inteiro' })
  @Min(1, { message: 'quantidade deve ser pelo menos 1' })
  quantidade?: number;

  @ApiPropertyOptional({ description: 'Alias English - quantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity deve ser um número inteiro' })
  @Min(1, { message: 'quantity deve ser pelo menos 1' })
  quantity?: number;

  get productIdNormalized(): string | undefined {
    return this.produto_id ?? this.product_id ?? this.productId;
  }

  get quantityNormalized(): number | undefined {
    return this.quantidade ?? this.quantity;
  }
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'Quantidade', example: 3, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantidade deve ser um número inteiro' })
  @Min(1, { message: 'quantidade deve ser pelo menos 1' })
  quantidade?: number;

  @ApiPropertyOptional({ description: 'Alias English - quantity' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity deve ser um número inteiro' })
  @Min(1, { message: 'quantity deve ser pelo menos 1' })
  quantity?: number;

  get quantityNormalized(): number | undefined {
    return this.quantidade ?? this.quantity;
  }
}
