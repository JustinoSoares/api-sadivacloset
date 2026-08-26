import { IsNumber, IsOptional, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiProperty({ description: 'Etiqueta', example: 'Casa' })
  @IsOptional()
  @IsString({ message: 'etiqueta deve ser texto' })
  @IsNotEmpty({ message: 'etiqueta não pode ser vazia' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Alias label' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiProperty({ description: 'Província', example: 'Luanda' })
  @IsOptional()
  @IsString({ message: 'provincia deve ser texto' })
  @IsNotEmpty({ message: 'provincia não pode ser vazia' })
  provincia?: string;

  @ApiPropertyOptional({ description: 'Alias province' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiProperty({ description: 'Município', example: 'Talatona' })
  @IsOptional()
  @IsString({ message: 'municipio deve ser texto' })
  @IsNotEmpty({ message: 'municipio não pode ser vazio' })
  municipio?: string;

  @ApiPropertyOptional({ description: 'Alias municipality' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiProperty({ description: 'Bairro', example: 'Benfica' })
  @IsOptional()
  @IsString({ message: 'bairro deve ser texto' })
  @IsNotEmpty({ message: 'bairro não pode ser vazio' })
  bairro?: string;

  @ApiPropertyOptional({ description: 'Alias neighborhood' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiProperty({ description: 'Rua', example: 'Rua 1, nº 123' })
  @IsOptional()
  @IsString({ message: 'rua deve ser texto' })
  @IsNotEmpty({ message: 'rua não pode ser vazia' })
  rua?: string;

  @ApiPropertyOptional({ description: 'Alias street' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Referência', example: 'Próximo ao mercado' })
  @IsOptional()
  @IsString({ message: 'referencia deve ser texto' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Alias reference' })
  @IsOptional()
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
    return this.etiqueta ?? this.label;
  }
  get provinceNormalized(): string | undefined {
    return this.provincia ?? this.province;
  }
  get municipalityNormalized(): string | undefined {
    return this.municipio ?? this.municipality;
  }
  get neighborhoodNormalized(): string | undefined {
    return this.bairro ?? this.neighborhood;
  }
  get streetNormalized(): string | undefined {
    return this.rua ?? this.street;
  }
  get referenceNormalized(): string | undefined {
    return this.referencia ?? this.reference;
  }
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'Etiqueta' })
  @IsOptional()
  @IsString({ message: 'etiqueta deve ser texto' })
  @IsNotEmpty({ message: 'etiqueta não pode ser vazia' })
  etiqueta?: string;

  @ApiPropertyOptional({ description: 'Alias label' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @ApiPropertyOptional({ description: 'Província' })
  @IsOptional()
  @IsString({ message: 'provincia deve ser texto' })
  @IsNotEmpty()
  provincia?: string;

  @ApiPropertyOptional({ description: 'Alias province' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiPropertyOptional({ description: 'Município' })
  @IsOptional()
  @IsString({ message: 'municipio deve ser texto' })
  @IsNotEmpty()
  municipio?: string;

  @ApiPropertyOptional({ description: 'Alias municipality' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @ApiPropertyOptional({ description: 'Bairro' })
  @IsOptional()
  @IsString({ message: 'bairro deve ser texto' })
  @IsNotEmpty()
  bairro?: string;

  @ApiPropertyOptional({ description: 'Alias neighborhood' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  neighborhood?: string;

  @ApiPropertyOptional({ description: 'Rua' })
  @IsOptional()
  @IsString({ message: 'rua deve ser texto' })
  @IsNotEmpty()
  rua?: string;

  @ApiPropertyOptional({ description: 'Alias street' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({ description: 'Referência' })
  @IsOptional()
  @IsString({ message: 'referencia deve ser texto' })
  referencia?: string;

  @ApiPropertyOptional({ description: 'Alias reference' })
  @IsOptional()
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
    return this.etiqueta ?? this.label;
  }
  get provinceNormalized(): string | undefined {
    return this.provincia ?? this.province;
  }
  get municipalityNormalized(): string | undefined {
    return this.municipio ?? this.municipality;
  }
  get neighborhoodNormalized(): string | undefined {
    return this.bairro ?? this.neighborhood;
  }
  get streetNormalized(): string | undefined {
    return this.rua ?? this.street;
  }
  get referenceNormalized(): string | undefined {
    return this.referencia ?? this.reference;
  }
}
