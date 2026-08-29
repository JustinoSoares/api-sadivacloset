import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterAuditoriaDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtro por entidade', example: 'pedido' })
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional({ description: 'Alias entity' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ description: 'Data início', example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'data_inicio deve ser data ISO válida' })
  data_inicio?: string;

  @ApiPropertyOptional({ description: 'Alias dataInicio' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve ser data ISO válida' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Alias from' })
  @IsOptional()
  @IsDateString({}, { message: 'from deve ser data ISO válida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Data fim', example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'data_fim deve ser data ISO válida' })
  data_fim?: string;

  @ApiPropertyOptional({ description: 'Alias dataFim' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve ser data ISO válida' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Alias to' })
  @IsOptional()
  @IsDateString({}, { message: 'to deve ser data ISO válida' })
  to?: string;
}
