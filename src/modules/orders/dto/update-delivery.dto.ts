import { IsDateString, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateDeliveryDto {
  @ApiPropertyOptional({
    description: 'Delivery address ID',
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

  @ApiHideProperty()
  @IsOptional()
  @IsUUID('4', { message: 'addressId must be a valid UUID' })
  enderecoId?: string;

  @ApiPropertyOptional({ description: 'Scheduled date (ISO)', example: '2026-09-10' })
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

  @ApiPropertyOptional({ description: 'Additional instructions' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'instructions must be a string' })
  instructions?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  instrucoes?: string;

  get addressIdNormalized(): string | undefined {
    const v = this.addressId ?? this.address_id ?? this.endereco_id ?? this.enderecoId;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get enderecoIdNormalized(): string | undefined {
    return this.addressIdNormalized;
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

  get instructionsNormalized(): string | undefined {
    const v = this.instructions ?? this.instrucoes;
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }

  get instrucoesNormalized(): string | undefined {
    return this.instructionsNormalized;
  }
}
