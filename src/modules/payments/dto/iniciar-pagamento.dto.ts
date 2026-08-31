import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class IniciarPagamentoDto {
  @ApiProperty({ description: 'Payment method', example: 'multicaixa_express' })
  @IsString({ message: 'method must be a string' })
  @IsNotEmpty({ message: 'method must not be empty' })
  @Trim()
  metodo!: string;

  @ApiPropertyOptional({ description: 'Payment method alias (English)' })
  @IsOptional()
  @IsString()
  @Trim()
  method?: string;

  @ApiPropertyOptional({
    description: 'Phone number for GPO (Multicaixa Express)',
    example: '923456789',
  })
  @IsOptional()
  @IsString({ message: 'phoneNumber must be a string' })
  @Trim()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Phone alias (legacy)' })
  @IsOptional()
  @IsString()
  @Trim()
  telefone?: string;

  @ApiPropertyOptional({ description: 'IBAN for KWIK', example: 'AO06004400006729503010148' })
  @IsOptional()
  @IsString({ message: 'iban must be a string' })
  @Trim()
  iban?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(255)
  @Trim()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Description alias (English)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Trim()
  description?: string;

  @ApiPropertyOptional({ description: 'Expiration in seconds for GPO', example: 900 })
  @IsOptional()
  @IsInt({ message: 'expiresInSeconds must be an integer' })
  @Min(60)
  expiresInSeconds?: number;

  get metodoNormalized(): string {
    const raw = this.metodo ?? this.method ?? '';
    return String(raw).trim().toLowerCase();
  }

  get phoneNormalized(): string | undefined {
    const v = this.phoneNumber ?? this.telefone;
    if (!v) return undefined;
    const t = String(v).trim();
    return t.length ? t : undefined;
  }

  get ibanNormalized(): string | undefined {
    if (!this.iban) return undefined;
    const t = String(this.iban).trim();
    return t.length ? t : undefined;
  }

  get descricaoNormalized(): string | undefined {
    const v = this.descricao ?? this.description;
    if (!v) return undefined;
    const t = String(v).trim();
    return t.length ? t : undefined;
  }
}
