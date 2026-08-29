import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

function mapOrderStatus(value: any): OrderStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const str = String(value).toLowerCase();
  const map: Record<string, OrderStatus> = {
    aguardando_pagamento: OrderStatus.AWAITING_PAYMENT,
    awaiting_payment: OrderStatus.AWAITING_PAYMENT,
    pago: OrderStatus.PAID,
    paid: OrderStatus.PAID,
    em_preparacao: OrderStatus.PREPARING,
    preparing: OrderStatus.PREPARING,
    em_entrega: OrderStatus.SHIPPING,
    shipping: OrderStatus.SHIPPING,
    concluido: OrderStatus.COMPLETED,
    completed: OrderStatus.COMPLETED,
    cancelado: OrderStatus.CANCELLED,
    cancelled: OrderStatus.CANCELLED,
    canceled: OrderStatus.CANCELLED,
  };
  return map[str] ?? value;
}

export class FilterOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtro por estado', example: 'aguardando_pagamento' })
  @IsOptional()
  @Transform(({ value }) => mapOrderStatus(value))
  @IsString()
  estado?: string;

  @ApiPropertyOptional({ description: 'Alias status' })
  @IsOptional()
  @Transform(({ value }) => mapOrderStatus(value))
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Data início intervalo (ISO)', example: '2026-01-01' })
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

  @ApiPropertyOptional({ description: 'Data fim intervalo (ISO)', example: '2026-12-31' })
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

  get estadoNormalized(): OrderStatus | undefined {
    const v = (this as any).estado ?? (this as any).status;
    return mapOrderStatus(v) as OrderStatus | undefined;
  }

  get startDateNormalized(): string | undefined {
    return this.data_inicio ?? this.dataInicio ?? this.startDate;
  }

  get endDateNormalized(): string | undefined {
    return this.data_fim ?? this.dataFim ?? this.endDate;
  }
}
