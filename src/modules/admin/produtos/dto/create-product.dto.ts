import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { Category, ProductCondition } from '@prisma/client';

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

function mapCondition(value: any): ProductCondition | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).toLowerCase();
  const map: Record<string, ProductCondition> = {
    novo: ProductCondition.NEW,
    new: ProductCondition.NEW,
    semi_novo: ProductCondition.PRE_OWNED,
    second_hand: ProductCondition.PRE_OWNED,
    pre_owned: ProductCondition.PRE_OWNED,
    'second-hand': ProductCondition.PRE_OWNED,
  };
  return (map[str] as ProductCondition) ?? value;
}

export class CreateProductDto {
  @ApiProperty({
    example: 'https://cdn.example.com/image.jpg',
    description: 'Image URL (from frontend)',
  })
  @Transform(({ obj }) => obj.image ?? obj.imagem)
  @IsString({ message: 'image must be a string' })
  @IsNotEmpty({ message: 'image is required' })
  @IsUrl({}, { message: 'image must be a valid URL' })
  image!: string;

  @ApiProperty({ example: 'Floral Dress' })
  @Transform(({ obj }) => obj.name ?? obj.nomeProduto ?? obj.nome)
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @ApiProperty({ example: 'Light dress for summer, size M' })
  @Transform(({ obj }) => obj.description ?? obj.descricao)
  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  description!: string;

  @ApiProperty({ enum: Category, example: Category.DRESSES })
  @Transform(({ obj }) => mapCategory(obj.category ?? obj.categoria))
  @IsEnum(Category, {
    message: `category must be one of: ${Object.values(Category).join(', ')}`,
  })
  category!: Category;

  @ApiProperty({ example: 'M' })
  @Transform(({ obj }) => obj.size ?? obj.tamanho)
  @IsString({ message: 'size must be a string' })
  @IsNotEmpty({ message: 'size is required' })
  size!: string;

  @ApiProperty({ enum: ProductCondition, example: ProductCondition.NEW })
  @Transform(({ obj }) => mapCondition(obj.condition ?? obj.estado))
  @IsEnum(ProductCondition, {
    message: `condition must be one of: ${Object.values(ProductCondition).join(', ')}`,
  })
  condition!: ProductCondition;

  @ApiProperty({ example: 10, description: 'Stock available, integer >= 0' })
  @Transform(({ obj }) => obj.stock ?? obj.volume)
  @IsInt({ message: 'stock must be an integer' })
  @Min(0, { message: 'stock must be >= 0' })
  stock!: number;

  @ApiProperty({ example: 25000, description: 'Price in AOA (integer) >= 0' })
  @IsInt({ message: 'price must be an integer' })
  @Min(0, { message: 'price must be >= 0' })
  price!: number;

  @ApiPropertyOptional({ example: 10, description: 'Discount 0-100' })
  @Transform(({ obj }) => obj.discount ?? obj.desconto)
  @IsOptional()
  @IsInt({ message: 'discount must be an integer' })
  @Min(0, { message: 'discount must be >= 0' })
  @Max(100, { message: 'discount must be <= 100' })
  discount?: number;

  // legacy aliases for validation whitelist
  @IsOptional() imagem?: string;
  @IsOptional() nomeProduto?: string;
  @IsOptional() nome?: string;
  @IsOptional() descricao?: string;
  @IsOptional() categoria?: Category;
  @IsOptional() tamanho?: string;
  @IsOptional() estado?: ProductCondition;
  @IsOptional() volume?: number;
  @IsOptional() desconto?: number;
}

// Keep legacy alias for backward compatibility (Portuguese payload)
export class CreateProdutoDto extends CreateProductDto {}
