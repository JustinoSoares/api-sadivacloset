import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Categoria } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class FiltrarProdutosDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por nome (q)', example: 'vestido' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Categoria, description: 'Filtra por categoria' })
  @IsOptional()
  @IsEnum(Categoria, { message: `categoria deve ser: ${Object.values(Categoria).join(', ')}` })
  categoria?: Categoria;
}
