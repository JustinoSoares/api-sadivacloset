import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DeliveryStatus } from '@prisma/client';

function normalize(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().toLowerCase();
}

const allowed = [
  'agendada',
  'scheduled',
  'a_caminho',
  'on_the_way',
  'entregue',
  'delivered',
  'falhada',
  'failed',
  'cancelada',
  'cancelled',
  'canceled',
];

export class UpdateDeliveryStatusDto {
  @ApiProperty({ description: 'Novo estado', example: 'a_caminho' })
  @IsString({ message: 'status must be a string' })
  @IsNotEmpty({ message: 'status cannot be empty' })
  @Transform(({ value }) => normalize(value))
  estado?: string;

  @ApiPropertyOptional({ description: 'Alias status' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => normalize(value))
  status?: string;

  get estadoNormalized(): string | undefined {
    const v = this.estado ?? this.status;
    if (!v) return undefined;
    const t = String(v).trim().toLowerCase();
    return t.length ? t : undefined;
  }

  static toEnum(normalized: string): DeliveryStatus {
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
    const e = map[normalized];
    if (!e) throw new Error(`Estado inválido: ${normalized}`);
    return e;
  }

  static isValid(normalized: string): boolean {
    return allowed.includes(normalized);
  }
}
