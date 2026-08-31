import { IsDateString, IsIn, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CheckoutDto {
  @ApiPropertyOptional({
    description: 'Address ID (for home delivery)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'addressId must be a valid UUID' })
  addressId?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'addressId must be a valid UUID' })
  address_id?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'addressId must be a valid UUID' })
  endereco_id?: string;

  @ApiPropertyOptional({ description: 'Delivery zone ID' })
  @IsOptional()
  @IsUUID('4', { message: 'deliveryZoneId must be a valid UUID' })
  deliveryZoneId?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'deliveryZoneId must be a valid UUID' })
  delivery_zone_id?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'deliveryZoneId must be a valid UUID' })
  zona_entrega_id?: string;

  @ApiPropertyOptional({
    description: 'Delivery type',
    example: 'domicilio',
    enum: ['domicilio', 'levantamento_loja', 'HOME_DELIVERY', 'STORE_PICKUP'],
  })
  @IsOptional()
  @Trim()
  @IsString({ message: 'type must be a string' })
  @IsIn(['domicilio', 'levantamento_loja', 'HOME_DELIVERY', 'STORE_PICKUP'], {
    message: 'type must be one of: domicilio, levantamento_loja, HOME_DELIVERY, STORE_PICKUP',
  })
  type?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString({ message: 'type must be a string' })
  @IsIn(['domicilio', 'levantamento_loja', 'HOME_DELIVERY', 'STORE_PICKUP'], {
    message: 'type must be one of: domicilio, levantamento_loja',
  })
  tipo?: string;

  @ApiPropertyOptional({ description: 'Scheduled date (ISO date)', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate must be a valid ISO date (YYYY-MM-DD)' })
  scheduledDate?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate must be a valid ISO date' })
  scheduled_date?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate must be a valid ISO date' })
  data_agendada?: string;

  @ApiPropertyOptional({ description: 'Time window', example: '09:00-12:00' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'timeWindow must be a string' })
  @IsNotEmpty({ message: 'timeWindow must not be empty' })
  timeWindow?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  time_window?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  janela_horario?: string;

  // --- normalized ---
  get addressIdNormalized(): string | undefined {
    const v = this.addressId ?? this.address_id ?? this.endereco_id;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get enderecoIdNormalized(): string | undefined {
    return this.addressIdNormalized;
  }

  get deliveryZoneIdNormalized(): string | undefined {
    const v = this.deliveryZoneId ?? this.delivery_zone_id ?? this.zona_entrega_id;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get zonaEntregaIdNormalized(): string | undefined {
    return this.deliveryZoneIdNormalized;
  }

  get typeNormalized(): string | undefined {
    const raw = this.type ?? this.tipo;
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;
    if (t === 'HOME_DELIVERY') return 'domicilio';
    if (t === 'STORE_PICKUP') return 'levantamento_loja';
    return t;
  }

  get tipoNormalized(): string | undefined {
    return this.typeNormalized;
  }

  get scheduledDateNormalized(): string | undefined {
    return this.scheduledDate ?? this.scheduled_date ?? this.data_agendada;
  }

  get dataAgendadaNormalized(): string | undefined {
    return this.scheduledDateNormalized;
  }

  get timeWindowNormalized(): string | undefined {
    const v = this.timeWindow ?? this.time_window ?? this.janela_horario;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get janelaHorarioNormalized(): string | undefined {
    return this.timeWindowNormalized;
  }
}
