import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DeliveryStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

function mapDeliveryStatus(value: any): DeliveryStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const str = String(value).toLowerCase();
  const map: Record<string, DeliveryStatus> = {
    agendada: DeliveryStatus.SCHEDULED,
    scheduled: DeliveryStatus.SCHEDULED,
    a_caminho: DeliveryStatus.ON_THE_WAY,
    on_the_way: DeliveryStatus.ON_THE_WAY,
    entregue: DeliveryStatus.DELIVERED,
    delivered: DeliveryStatus.DELIVERED,
    falhada: DeliveryStatus.FAILED,
    failed: DeliveryStatus.FAILED,
    cancelada: DeliveryStatus.CANCELLED,
    cancelled: DeliveryStatus.CANCELLED,
    canceled: DeliveryStatus.CANCELLED,
  };
  return map[str] ?? value;
}

export class FilterDeliveriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtro por estado', example: 'agendada' })
  @IsOptional()
  @Transform(({ value }) => mapDeliveryStatus(value))
  @IsString()
  estado?: string;

  @ApiPropertyOptional({ description: 'Alias status' })
  @IsOptional()
  @Transform(({ value }) => mapDeliveryStatus(value))
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Data início (ISO)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'data_inicio deve ser data ISO válida' })
  data_inicio?: string;

  @ApiPropertyOptional({ description: 'Alias dataInicio' })
  @IsOptional()
  @IsDateString({}, { message: 'dataInicio deve ser data ISO válida' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Alias startDate' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate deve ser data ISO válida' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data fim (ISO)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'data_fim deve ser data ISO válida' })
  data_fim?: string;

  @ApiPropertyOptional({ description: 'Alias dataFim' })
  @IsOptional()
  @IsDateString({}, { message: 'dataFim deve ser data ISO válida' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Alias endDate' })
  @IsOptional()
  @IsDateString({}, { message: 'endDate deve ser data ISO válida' })
  endDate?: string;

  get estadoNormalized(): DeliveryStatus | undefined {
    const v = (this as any).estado ?? (this as any).status;
    return mapDeliveryStatus(v) as DeliveryStatus | undefined;
  }

  get startDateNormalized(): string | undefined {
    return this.data_inicio ?? this.dataInicio ?? this.startDate;
  }

  get endDateNormalized(): string | undefined {
    return this.data_fim ?? this.dataFim ?? this.endDate;
  }
}
