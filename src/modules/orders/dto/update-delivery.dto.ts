import { IsDateString, IsOptional, IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateDeliveryDto {
  @ApiPropertyOptional({ description: 'ID do endereço da entrega', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID('4', { message: 'endereco_id deve ser um UUID válido' })
  endereco_id?: string;

  @ApiPropertyOptional({ description: 'Alias address_id' })
  @IsOptional()
  @IsUUID('4', { message: 'address_id deve ser um UUID válido' })
  address_id?: string;

  @ApiPropertyOptional({ description: 'Alias enderecoId camelCase' })
  @IsOptional()
  @IsUUID('4', { message: 'enderecoId deve ser um UUID válido' })
  enderecoId?: string;

  @ApiPropertyOptional({ description: 'Data agendada (ISO)', example: '2026-09-10' })
  @IsOptional()
  @IsDateString({}, { message: 'data_agendada deve ser data ISO válida (YYYY-MM-DD)' })
  data_agendada?: string;

  @ApiPropertyOptional({ description: 'Alias scheduled_date' })
  @IsOptional()
  @IsDateString({}, { message: 'scheduled_date deve ser data ISO válida' })
  scheduled_date?: string;

  @ApiPropertyOptional({ description: 'Alias scheduledDate' })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledDate deve ser data ISO válida' })
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Janela de horário', example: '09:00-12:00' })
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

  @ApiPropertyOptional({ description: 'Alias timeWindow' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  timeWindow?: string;

  @ApiPropertyOptional({ description: 'Instruções adicionais' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'instrucoes deve ser texto' })
  instrucoes?: string;

  @ApiPropertyOptional({ description: 'Alias instructions' })
  @IsOptional()
  @Trim()
  @IsString()
  instructions?: string;

  get enderecoIdNormalized(): string | undefined {
    const v = this.endereco_id ?? this.address_id ?? this.enderecoId;
    if (!v) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
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

  get instrucoesNormalized(): string | undefined {
    const v = this.instrucoes ?? this.instructions;
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  }
}
