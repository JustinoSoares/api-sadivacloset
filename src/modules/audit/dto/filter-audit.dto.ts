import {ApiPropertyOptional, ApiHideProperty} from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterAuditDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by entity', example: 'order' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional({ description: 'Start date', example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'from must be valid ISO date' })
  from?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'data_inicio must be valid ISO date' })
  data_inicio?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio must be valid ISO date' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'End date', example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'to must be valid ISO date' })
  to?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'data_fim must be valid ISO date' })
  data_fim?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'dataFim must be valid ISO date' })
  dataFim?: string;
}

export const FilterAuditoriaDto = FilterAuditDto;
