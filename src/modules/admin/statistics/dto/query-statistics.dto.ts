import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QueryStatisticsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Window in days for comparison (1-365)', example: 30, minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: 'Alias dias/period' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;

  @ApiPropertyOptional({ description: 'Alias period' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  period?: number;

  @ApiPropertyOptional({ description: 'Start date of current period (ISO)', example: '2026-07-01' })
  @IsOptional()
  @IsDateString({}, { message: 'from must be valid ISO date' })
  from?: string;

  @ApiPropertyOptional({ description: 'Alias data_inicio' })
  @IsOptional()
  @IsDateString({}, { message: 'data_inicio deve ser data ISO válida' })
  data_inicio?: string;

  @ApiPropertyOptional({ description: 'Alias dataInicio/startDate' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve ser data ISO válida' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Alias startDate' })
  @IsOptional()
  @IsDateString({}, { message: 'from deve ser data ISO válida' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date of current period (ISO)', example: '2026-07-31' })
  @IsOptional()
  @IsDateString({}, { message: 'to must be valid ISO date' })
  to?: string;

  @ApiPropertyOptional({ description: 'Alias data_fim' })
  @IsOptional()
  @IsDateString({}, { message: 'data_fim deve ser data ISO válida' })
  data_fim?: string;

  @ApiPropertyOptional({ description: 'Alias dataFim/endDate' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve ser data ISO válida' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Alias endDate' })
  @IsOptional()
  @IsDateString({}, { message: 'to deve ser data ISO válida' })
  endDate?: string;

  get daysNormalized(): number {
    return this.days ?? this.dias ?? this.period ?? 30;
  }

  get diasNormalized(): number {
    return this.days ?? this.dias ?? this.period ?? 30;
  }

  get startNormalized(): string | undefined {
    return this.from ?? this.data_inicio ?? this.dataInicio ?? this.startDate;
  }

  get inicioNormalized(): string | undefined {
    return this.startNormalized;
  }

  get endNormalized(): string | undefined {
    return this.to ?? this.data_fim ?? this.dataFim ?? this.endDate;
  }

  get fimNormalized(): string | undefined {
    return this.endNormalized;
  }
}

// legacy aliases
export const QueryEstatisticasDto = QueryStatisticsDto;
export type QueryEstatisticasDtoType = QueryStatisticsDto;
