import { IsNumber, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'label must be a string' })
  @IsNotEmpty({ message: 'label must not be empty' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiProperty({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'province must be a string' })
  @IsNotEmpty({ message: 'province must not be empty' })
  provincia?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiProperty({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipality must be a string' })
  @IsNotEmpty({ message: 'municipality must not be empty' })
  municipio?: string;

  @ApiPropertyOptional({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiProperty({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty({ message: 'neighborhood must not be empty' })
  bairro?: string;

  @ApiPropertyOptional({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiProperty({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'street must be a string' })
  @IsNotEmpty({ message: 'street must not be empty' })
  rua?: string;

  @ApiPropertyOptional({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'reference must be a string' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString()
  reference?: string;

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
  @ApiPropertyOptional({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'label must be a string' })
  @IsNotEmpty({ message: 'label must not be empty' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Label', example: 'Home' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'province must be a string' })
  @IsNotEmpty()
  provincia?: string;

  @ApiPropertyOptional({ description: 'Province', example: 'Luanda' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiPropertyOptional({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'municipality must be a string' })
  @IsNotEmpty()
  municipio?: string;

  @ApiPropertyOptional({ description: 'Municipality', example: 'Talatona' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiPropertyOptional({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'neighborhood must be a string' })
  @IsNotEmpty()
  bairro?: string;

  @ApiPropertyOptional({ description: 'Neighborhood', example: 'Benfica' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiPropertyOptional({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'street must be a string' })
  @IsNotEmpty()
  rua?: string;

  @ApiPropertyOptional({ description: 'Street', example: '123 Main St' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'reference must be a string' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Reference', example: 'Near the market' })
  @IsOptional()
  @Trim()
  @IsString()
  reference?: string;

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
