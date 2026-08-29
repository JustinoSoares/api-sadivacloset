import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QueryEstatisticasDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Janela em dias para comparação (1-365)', example: 30, minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dias?: number;

  @ApiPropertyOptional({ description: 'Alias period/days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  period?: number;

  @ApiPropertyOptional({ description: 'Alias days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: 'Data início do período atual (ISO)', example: '2026-07-01' })
  @IsOptional()
  @IsDateString({}, { message: 'data_inicio deve ser data ISO válida' })
  data_inicio?: string;

  @ApiPropertyOptional({ description: 'Alias dataInicio' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve ser data ISO válida' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Alias from/startDate' })
  @IsOptional()
  @IsDateString({}, { message: 'from deve ser data ISO válida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Data fim do período atual (ISO)', example: '2026-07-31' })
  @IsOptional()
  @IsDateString({}, { message: 'data_fim deve ser data ISO válida' })
  data_fim?: string;

  @ApiPropertyOptional({ description: 'Alias dataFim' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve ser data ISO válida' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Alias to/endDate' })
  @IsOptional()
  @IsDateString({}, { message: 'to deve ser data ISO válida' })
  to?: string;

  get diasNormalized(): number {
    return this.dias ?? this.period ?? this.days ?? 30;
  }

  get inicioNormalized(): string | undefined {
    return this.data_inicio ?? this.dataInicio ?? this.from;
  }

  get fimNormalized(): string | undefined {
    return this.data_fim ?? this.dataFim ?? this.to;
  }
}
