import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateDeliveryZoneDto {
  @ApiProperty({ example: 'Talatona', description: 'Bairro - único' })
  @Transform(({ obj }) => obj.neighborhood ?? obj.bairro ?? obj.bairros)
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty({ message: 'neighborhood is required' })
  @MaxLength(100, { message: 'neighborhood must have at most 100 characters' })
  @Trim()
  neighborhood!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiProperty({ example: 2500, description: 'Preço da entrega em Kz (inteiro >=0)' })
  @Transform(({ obj }) => obj.price ?? obj.preco ?? obj.preço ?? obj.valor)
  @IsInt({ message: 'price must be an integer' })
  @Min(0, { message: 'price must be >= 0' })
  price!: number;

  @ApiHideProperty()
  @IsOptional()
  @IsInt()
  preco?: number;

  @ApiHideProperty()
  @IsOptional()
  @IsInt()
  valor?: number;
}

export class UpdateDeliveryZoneDto {
  @ApiPropertyOptional({ example: 'Talatona', description: 'Bairro' })
  @Transform(({ obj }) => obj.neighborhood ?? obj.bairro)
  @IsOptional()
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty({ message: 'neighborhood cannot be empty' })
  @MaxLength(100)
  @Trim()
  neighborhood?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  bairro?: string;

  @ApiPropertyOptional({ example: 3000, description: 'Preço em Kz' })
  @Transform(({ obj }) => obj.price ?? obj.preco ?? obj.preço ?? obj.valor)
  @IsOptional()
  @IsInt({ message: 'price must be an integer' })
  @Min(0, { message: 'price must be >= 0' })
  price?: number;

  @ApiHideProperty()
  @IsOptional()
  @IsInt()
  preco?: number;

  @ApiHideProperty()
  @IsOptional()
  @IsInt()
  valor?: number;
}
