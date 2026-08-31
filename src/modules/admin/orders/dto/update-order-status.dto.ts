import {ApiProperty, ApiPropertyOptional, ApiHideProperty} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

function mapOrderStatus(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().toLowerCase();
}

const allowedValues = [
  'aguardando_pagamento',
  'awaiting_payment',
  'pago',
  'paid',
  'em_preparacao',
  'preparing',
  'em_entrega',
  'shipping',
  'concluido',
  'completed',
  'cancelado',
  'cancelled',
  'canceled',
];

export class UpdateOrderStatusDto {
  @ApiHideProperty()
  @IsString({ message: 'status must be a string' })
  @IsNotEmpty({ message: 'status cannot be empty' })
  @Transform(({ value }) => mapOrderStatus(value))
  estado?: string;

  @ApiProperty({ description: 'Order status', example: 'paid', enum: ['awaiting_payment','paid','preparing','shipping','completed','cancelled'] })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => mapOrderStatus(value))
  status?: string;

  get estadoNormalized(): string | undefined {
    const v = this.estado ?? this.status;
    if (!v) return undefined;
    const t = String(v).trim().toLowerCase();
    return t.length ? t : undefined;
  }

  static toEnum(normalized: string): OrderStatus {
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
    const e = map[normalized];
    if (!e) throw new Error(`Estado inválido: ${normalized}`);
    return e;
  }

  static isValid(normalized: string): boolean {
    return allowedValues.includes(normalized);
  }
}
