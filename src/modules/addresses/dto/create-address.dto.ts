import { IsNumber, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

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
  @ApiPropertyOptional({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'label must be a string' })
  @IsNotEmpty({ message: 'label must not be empty' })
  label?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'province must be a string' })
  @IsNotEmpty({ message: 'province must not be empty' })
  province?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  provincia?: string;

  @ApiPropertyOptional({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipality must be a string' })
  @IsNotEmpty({ message: 'municipality must not be empty' })
  municipality?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipio?: string;

  @ApiPropertyOptional({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty({ message: 'neighborhood must not be empty' })
  neighborhood?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  bairro?: string;

  @ApiPropertyOptional({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'street must be a string' })
  @IsNotEmpty({ message: 'street must not be empty' })
  street?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  rua?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'reference must be a string' })
  reference?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional({ description: 'Latitude', example: -8.8368 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a number' })
  @Min(-90, { message: 'latitude must be >= -90' })
  @Max(90, { message: 'latitude must be <= 90' })
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: 13.2344 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a number' })
  @Min(-180, { message: 'longitude must be >= -180' })
  @Max(180, { message: 'longitude must be <= 180' })
  longitude?: number;

  get labelNormalized(): string | undefined {
    return normalizeStr(this.label ?? this.etiqueta);
  }
  get provinceNormalized(): string | undefined {
    return normalizeStr(this.province ?? this.provincia);
  }
  get municipalityNormalized(): string | undefined {
    return normalizeStr(this.municipality ?? this.municipio);
  }
  get neighborhoodNormalized(): string | undefined {
    return normalizeStr(this.neighborhood ?? this.bairro);
  }
  get streetNormalized(): string | undefined {
    return normalizeStr(this.street ?? this.rua);
  }
  get referenceNormalized(): string | undefined {
    return normalizeRef(this.reference ?? this.referencia);
  }
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'label must be a string' })
  @IsNotEmpty({ message: 'label must not be empty' })
  label?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'province must be a string' })
  @IsNotEmpty()
  province?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  provincia?: string;

  @ApiPropertyOptional({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipality must be a string' })
  @IsNotEmpty()
  municipality?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipio?: string;

  @ApiPropertyOptional({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty()
  neighborhood?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  bairro?: string;

  @ApiPropertyOptional({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'street must be a string' })
  @IsNotEmpty()
  street?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  rua?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'reference must be a string' })
  reference?: string;

  @ApiHideProperty()
  @IsOptional()
  @Trim()
  @IsString()
  referencia?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a number' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a number' })
  @Min(-180)
  @Max(180)
  longitude?: number;

  get labelNormalized(): string | undefined {
    return normalizeStr(this.label ?? this.etiqueta);
  }
  get provinceNormalized(): string | undefined {
    return normalizeStr(this.province ?? this.provincia);
  }
  get municipalityNormalized(): string | undefined {
    return normalizeStr(this.municipality ?? this.municipio);
  }
  get neighborhoodNormalized(): string | undefined {
    return normalizeStr(this.neighborhood ?? this.bairro);
  }
  get streetNormalized(): string | undefined {
    return normalizeStr(this.street ?? this.rua);
  }
  get referenceNormalized(): string | undefined {
    return normalizeRef(this.reference ?? this.referencia);
  }
}
