import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateStoreDto {
  @ApiPropertyOptional({ description: 'Store name', example: 'SadivaCloset' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must have at least 2 characters' })
  @MaxLength(100, { message: 'name must have at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({ description: 'Alias nome' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'nome deve ser texto' })
  @MinLength(2)
  @MaxLength(100)
  nome?: string;

  @ApiPropertyOptional({ description: 'Contact email', example: 'contacto@sadivacloset.co.ao' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  @ApiPropertyOptional({ description: 'Alias contactEmail' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'contactEmail must be a valid email' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Alias email_contacto' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email_contacto must be a valid email' })
  email_contacto?: string;

  @ApiPropertyOptional({ description: 'Phone', example: '+244 900 000 000' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'phone must be a string' })
  @MinLength(8, { message: 'phone must have at least 8 characters' })
  @MaxLength(20, { message: 'phone must have at most 20 characters' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Alias telefone' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'telefone deve ser texto' })
  @MinLength(8)
  @MaxLength(20)
  telefone?: string;

  @ApiPropertyOptional({ description: 'Address', example: 'Luanda, Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'address must be a string' })
  @MinLength(5, { message: 'address must have at least 5 characters' })
  @MaxLength(500, { message: 'address must have at most 500 characters' })
  address?: string;

  @ApiPropertyOptional({ description: 'Alias morada' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'morada must be a string' })
  @MinLength(5)
  @MaxLength(500)
  morada?: string;

  get nameNormalized(): string | undefined {
    const v = this.name ?? this.nome;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get nomeNormalized(): string | undefined {
    return this.nameNormalized;
  }

  get emailNormalized(): string | undefined {
    const v = this.email ?? this.contactEmail ?? this.email_contacto;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get phoneNormalized(): string | undefined {
    const v = this.phone ?? this.telefone;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get telefoneNormalized(): string | undefined {
    return this.phoneNormalized;
  }

  get addressNormalized(): string | undefined {
    const v = this.address ?? this.morada;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get moradaNormalized(): string | undefined {
    return this.addressNormalized;
  }
}

export class UpdateLojaDto extends UpdateStoreDto {}
