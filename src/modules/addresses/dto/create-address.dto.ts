import { IsNumber, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

function normalizeStr(v?: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}
function normalizeRef(v?: string): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export class CreateAddressDto {
  @ApiProperty({ description: 'Etiqueta', example: 'Casa' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'etiqueta deve ser texto' })
  @IsNotEmpty({ message: 'etiqueta não pode ser vazia' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Alias label' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiProperty({ description: 'Província', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'provincia deve ser texto' })
  @IsNotEmpty({ message: 'provincia não pode ser vazia' })
  provincia?: string;

  @ApiPropertyOptional({ description: 'Alias province' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiProperty({ description: 'Município', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipio deve ser texto' })
  @IsNotEmpty({ message: 'municipio não pode ser vazio' })
  municipio?: string;

  @ApiPropertyOptional({ description: 'Alias municipality' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiProperty({ description: 'Bairro', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'bairro deve ser texto' })
  @IsNotEmpty({ message: 'bairro não pode ser vazio' })
  bairro?: string;

  @ApiPropertyOptional({ description: 'Alias neighborhood' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiProperty({ description: 'Rua', example: 'Rua 1, nº 123' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'rua deve ser texto' })
  @IsNotEmpty({ message: 'rua não pode ser vazia' })
  rua?: string;

  @ApiPropertyOptional({ description: 'Alias street' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Referência', example: 'Próximo ao mercado' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'referencia deve ser texto' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Alias reference' })
  @IsOptional()
  @Trim()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: -8.8368 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude deve ser número' })
  @Min(-90, { message: 'latitude deve ser >= -90' })
  @Max(90, { message: 'latitude deve ser <= 90' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 13.2344 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude deve ser número' })
  @Min(-180, { message: 'longitude deve ser >= -180' })
  @Max(180, { message: 'longitude deve ser <= 180' })
  longitude?: number;

  get labelNormalized(): string | undefined {
    return normalizeStr(this.etiqueta ?? this.label);
  }
  get provinceNormalized(): string | undefined {
    return normalizeStr(this.provincia ?? this.province);
  }
  get municipalityNormalized(): string | undefined {
    return normalizeStr(this.municipio ?? this.municipality);
  }
  get neighborhoodNormalized(): string | undefined {
    return normalizeStr(this.bairro ?? this.neighborhood);
  }
  get streetNormalized(): string | undefined {
    return normalizeStr(this.rua ?? this.street);
  }
  get referenceNormalized(): string | undefined {
    return normalizeRef(this.referencia ?? this.reference);
  }
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'Etiqueta' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'etiqueta deve ser texto' })
  @IsNotEmpty({ message: 'etiqueta não pode ser vazia' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Alias label' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Província' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'provincia deve ser texto' })
  @IsNotEmpty()
  provincia?: string;

  @ApiPropertyOptional({ description: 'Alias province' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiPropertyOptional({ description: 'Município' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipio deve ser texto' })
  @IsNotEmpty()
  municipio?: string;

  @ApiPropertyOptional({ description: 'Alias municipality' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiPropertyOptional({ description: 'Bairro' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'bairro deve ser texto' })
  @IsNotEmpty()
  bairro?: string;

  @ApiPropertyOptional({ description: 'Alias neighborhood' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiPropertyOptional({ description: 'Rua' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'rua deve ser texto' })
  @IsNotEmpty()
  rua?: string;

  @ApiPropertyOptional({ description: 'Alias street' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Referência' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'referencia deve ser texto' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Alias reference' })
  @IsOptional()
  @Trim()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude deve ser número' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude deve ser número' })
  @Min(-180)
  @Max(180)
  longitude?: number;

  get labelNormalized(): string | undefined {
    return normalizeStr(this.etiqueta ?? this.label);
  }
  get provinceNormalized(): string | undefined {
    return normalizeStr(this.provincia ?? this.province);
  }
  get municipalityNormalized(): string | undefined {
    return normalizeStr(this.municipio ?? this.municipality);
  }
  get neighborhoodNormalized(): string | undefined {
    return normalizeStr(this.bairro ?? this.neighborhood);
  }
  get streetNormalized(): string | undefined {
    return normalizeStr(this.rua ?? this.street);
  }
  get referenceNormalized(): string | undefined {
    return normalizeRef(this.referencia ?? this.reference);
  }
}
