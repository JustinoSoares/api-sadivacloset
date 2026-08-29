import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class IniciarPagamentoDto {
  @ApiProperty({ description: 'Método de pagamento', example: 'multicaixa_express' })
  @IsString({ message: 'metodo deve ser texto' })
  @IsNotEmpty({ message: 'metodo não pode ser vazio' })
  @Trim()
  metodo!: string;

  @ApiPropertyOptional({ description: 'Alias method' })
  @IsOptional()
  @IsString()
  @Trim()
  method?: string;

  @ApiPropertyOptional({ description: 'Telefone para GPO (Multicaixa Express)', example: '923456789' })
  @IsOptional()
  @IsString({ message: 'phoneNumber deve ser texto' })
  @Trim()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Alias telefone' })
  @IsOptional()
  @IsString()
  @Trim()
  telefone?: string;

  @ApiPropertyOptional({ description: 'IBAN para KWIK', example: 'AO06004400006729503010148' })
  @IsOptional()
  @IsString({ message: 'iban deve ser texto' })
  @Trim()
  iban?: string;

  @ApiPropertyOptional({ description: 'Descrição' })
  @IsOptional()
  @IsString({ message: 'descricao deve ser texto' })
  @MaxLength(255)
  @Trim()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Alias description' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Trim()
  description?: string;

  @ApiPropertyOptional({ description: 'Expiração em segundos para GPO', example: 900 })
  @IsOptional()
  @IsInt({ message: 'expiresInSeconds deve ser inteiro' })
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
