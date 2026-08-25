import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { Categoria, EstadoProduto } from '@prisma/client';

export class CreateProdutoDto {
  @ApiProperty({
    example: 'https://cdn.exemplo.com/imagem.jpg',
    description: 'URL da imagem (vinda do front)',
  })
  @IsString({ message: 'imagem deve ser uma string' })
  @IsNotEmpty({ message: 'imagem é obrigatória' })
  @IsUrl({}, { message: 'imagem deve ser uma URL válida' })
  imagem!: string;

  @ApiProperty({ example: 'Vestido Floral' })
  @IsString({ message: 'nomeProduto deve ser uma string' })
  @IsNotEmpty({ message: 'nomeProduto é obrigatório' })
  nomeProduto!: string;

  @ApiProperty({ example: 'Vestido leve para verão, tamanho M' })
  @IsString({ message: 'descricao deve ser uma string' })
  @IsNotEmpty({ message: 'descricao é obrigatória' })
  descricao!: string;

  @ApiProperty({ enum: Categoria, example: Categoria.vestidos })
  @IsEnum(Categoria, {
    message: `categoria deve ser um dos valores: ${Object.values(Categoria).join(', ')}`,
  })
  categoria!: Categoria;

  @ApiProperty({ example: 'M' })
  @IsString({ message: 'tamanho deve ser uma string' })
  @IsNotEmpty({ message: 'tamanho é obrigatório' })
  tamanho!: string;

  @ApiProperty({ enum: EstadoProduto, example: EstadoProduto.novo })
  @IsEnum(EstadoProduto, {
    message: `estado deve ser um dos valores: ${Object.values(EstadoProduto).join(', ')}`,
  })
  estado!: EstadoProduto;

  @ApiProperty({ example: 10, description: 'Stock disponível, inteiro >= 0' })
  @IsInt({ message: 'volume deve ser um inteiro' })
  @Min(0, { message: 'volume deve ser >= 0' })
  volume!: number;

  @ApiProperty({ example: 25000, description: 'Preço em AOA (inteiro) >= 0' })
  @IsInt({ message: 'price deve ser um inteiro' })
  @Min(0, { message: 'price deve ser >= 0' })
  price!: number;

  @ApiPropertyOptional({ example: 10, description: 'Desconto 0-100' })
  @IsOptional()
  @IsInt({ message: 'desconto deve ser um inteiro' })
  @Min(0, { message: 'desconto deve ser >= 0' })
  @Max(100, { message: 'desconto deve ser <= 100' })
  desconto?: number;
}
