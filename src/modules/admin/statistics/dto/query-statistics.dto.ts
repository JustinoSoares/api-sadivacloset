import {ApiPropertyOptional, ApiHideProperty} from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QueryStatisticsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Window in days for comparison (1-365)',
    example: 30,
    minimum: 1,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;

  @ApiHideProperty()
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

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  data_inicio?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  dataInicio?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO date' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date of current period (ISO)', example: '2026-07-31' })
  @IsOptional()
  @IsDateString({}, { message: 'to must be valid ISO date' })
  to?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
  data_fim?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
  dataFim?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO date' })
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
