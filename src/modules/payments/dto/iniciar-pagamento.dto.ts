import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class IniciarPagamentoDto {
  @ApiProperty({
    description:
      'Payment method. Use GPO for Multicaixa Express (phone required) or GPR for Referência (no phone). Canonical EN values: MULTICAIXA_EXPRESS | MULTICAIXA_REFERENCE | BANK_TRANSFER | CASH_ON_DELIVERY | CARD | kwik. Aliases: gpo | gpr | reference | bank_transfer',
    enum: [
      'MULTICAIXA_EXPRESS',
      'MULTICAIXA_REFERENCE',
      'BANK_TRANSFER',
      'CASH_ON_DELIVERY',
      'CARD',
      'kwik',
      'gpo',
      'gpr',
      'multicaixa_express',
      'multicaixa_reference',
      'reference',
      'bank_transfer',
    ],
    example: 'gpo',
    examples: {
      gpo: { value: 'gpo', summary: 'GPO - Multicaixa Express (requires phoneNumber)' },
      gpr: { value: 'gpr', summary: 'GPR - Referência Multicaixa (no phone)' },
      bank: { value: 'BANK_TRANSFER', summary: 'Transferência bancária' },
    } as any,
  })
  @IsString({ message: 'method must be a string' })
  @IsNotEmpty({ message: 'method must not be empty' })
  @Transform(({ obj }) => obj.method ?? obj.metodo)
  @Trim()
  method!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @Trim()
  metodo?: string;

  @ApiPropertyOptional({
    description: 'Phone number for GPO (Multicaixa Express) - REQUIRED when method=gpo/MULTICAIXA_EXPRESS/multicaixa_express. Ignored for GPR/BANK_TRANSFER. Format: 923456789 (AO without +244)',
    example: '923456789',
  })
  @IsOptional()
  @IsString({ message: 'phoneNumber must be a string' })
  @Trim()
  phoneNumber?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @Trim()
  telefone?: string;

  @ApiPropertyOptional({ description: 'IBAN for KWIK (method=kwik). Starts with AO06. Only used when method=kwik.', example: 'AO06004400006729503010148' })
  @IsOptional()
  @IsString({ message: 'iban must be a string' })
  @Trim()
  iban?: string;

  @ApiPropertyOptional({ description: 'Optional description for gateway (e.g. Pedido #123). Shown in AppyPay dashboard.', example: 'Pedido abc123 - GPO' })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(255)
  @Trim()
  @Transform(({ obj }) => obj.description ?? obj.descricao)
  description?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Trim()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Expiration in seconds for GPO/GPR reference (min 60). Default defined by gateway.', example: 900 })
  @IsOptional()
  @IsInt({ message: 'expiresInSeconds must be an integer' })
  @Min(60)
  expiresInSeconds?: number;

  get methodNormalized(): string {
    const raw = this.method ?? this.metodo ?? '';
    return String(raw).trim().toLowerCase();
  }

  // backward compat alias
  get metodoNormalized(): string {
    return this.methodNormalized;
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

  get descriptionNormalized(): string | undefined {
    const v = this.description ?? this.descricao;
    if (!v) return undefined;
    const t = String(v).trim();
    return t.length ? t : undefined;
  }

  get descricaoNormalized(): string | undefined {
    return this.descriptionNormalized;
  }
}
