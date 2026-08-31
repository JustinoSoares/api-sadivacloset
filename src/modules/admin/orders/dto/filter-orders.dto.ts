import {ApiPropertyOptional, ApiHideProperty} from '@nestjs/swagger';
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
  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => mapOrderStatus(value))
  @IsString()
  estado?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['awaiting_payment','paid','preparing','shipping','completed','cancelled'] })
  @IsOptional()
  @Transform(({ value }) => mapOrderStatus(value))
  @IsString()
  status?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  data_inicio?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Alias startDate' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date' })
  startDate?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
  data_fim?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Alias endDate' })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date' })
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
