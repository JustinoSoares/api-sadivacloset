import { IsDateString, IsIn, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CheckoutDto {
  @ApiPropertyOptional({ description: 'ID do endereço (para entrega domicílio)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID('4', { message: 'endereco_id deve ser um UUID válido' })
  endereco_id?: string;

  @ApiPropertyOptional({ description: 'Alias address_id' })
  @IsOptional()
  @IsUUID('4', { message: 'address_id deve ser um UUID válido' })
  address_id?: string;

  @ApiPropertyOptional({ description: 'ID da zona de entrega' })
  @IsOptional()
  @IsUUID('4', { message: 'zona_entrega_id deve ser um UUID válido' })
  zona_entrega_id?: string;

  @ApiPropertyOptional({ description: 'Alias delivery_zone_id' })
  @IsOptional()
  @IsUUID('4', { message: 'delivery_zone_id deve ser um UUID válido' })
  delivery_zone_id?: string;

  @ApiProperty({ description: 'Tipo de entrega', example: 'domicilio', enum: ['domicilio', 'levantamento_loja'] })
  @IsOptional()
  @Trim()
  @IsString({ message: 'tipo deve ser texto' })
  @IsIn(['domicilio', 'levantamento_loja'], { message: 'tipo deve ser domicilio ou levantamento_loja' })
  tipo?: string;

  @ApiPropertyOptional({ description: 'Alias type (HOME_DELIVERY | STORE_PICKUP)' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsIn(['domicilio', 'levantamento_loja', 'HOME_DELIVERY', 'STORE_PICKUP'], { message: 'type deve ser domicilio ou levantamento_loja' })
  type?: string;

  @ApiProperty({ description: 'Data agendada (ISO date)', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({}, { message: 'data_agendada deve ser data ISO válida (YYYY-MM-DD)' })
  data_agendada?: string;

  @ApiPropertyOptional({ description: 'Alias scheduled_date' })
  @IsOptional()
  @IsDateString({}, { message: 'scheduled_date deve ser data ISO válida' })
  scheduled_date?: string;

  @ApiPropertyOptional({ description: 'Alias scheduledDate camelCase' })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate deve ser data ISO válida' })
  scheduledDate?: string;

  @ApiProperty({ description: 'Janela de horário', example: '09:00-12:00' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'janela_horario deve ser texto' })
  @IsNotEmpty({ message: 'janela_horario não pode ser vazia' })
  janela_horario?: string;

  @ApiPropertyOptional({ description: 'Alias time_window' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  time_window?: string;

  @ApiPropertyOptional({ description: 'Alias timeWindow camelCase' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  timeWindow?: string;

  // --- normalizados ---
  get enderecoIdNormalized(): string | undefined {
    const v = this.endereco_id ?? this.address_id;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get zonaEntregaIdNormalized(): string | undefined {
    const v = this.zona_entrega_id ?? this.delivery_zone_id;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get tipoNormalized(): string | undefined {
    const raw = this.tipo ?? this.type;
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;
    // normaliza EN aliases para PT
    if (t === 'HOME_DELIVERY') return 'domicilio';
    if (t === 'STORE_PICKUP') return 'levantamento_loja';
    return t;
  }

  get dataAgendadaNormalized(): string | undefined {
    return this.data_agendada ?? this.scheduled_date ?? this.scheduledDate;
  }

  get janelaHorarioNormalized(): string | undefined {
    const v = this.janela_horario ?? this.time_window ?? this.timeWindow;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }
}
