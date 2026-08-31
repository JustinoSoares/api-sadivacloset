import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateLojaDto {
  @ApiPropertyOptional({ description: 'Nome da loja', example: 'SadivaCloset' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'nome deve ter pelo menos 2 caracteres' })
  @MaxLength(100, { message: 'nome deve ter no máximo 100 caracteres' })
  nome?: string;

  @ApiPropertyOptional({ description: 'Alias name' })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Email de contacto', example: 'contacto@sadivacloset.co.ao' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email deve ser um email válido' })
  email?: string;

  @ApiPropertyOptional({ description: 'Alias contactEmail' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'contactEmail deve ser um email válido' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Alias email_contacto' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email_contacto deve ser um email válido' })
  email_contacto?: string;

  @ApiPropertyOptional({ description: 'Telefone', example: '+244 900 000 000' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'phone must be a string' })
  @MinLength(8, { message: 'telefone deve ter pelo menos 8 caracteres' })
  @MaxLength(20, { message: 'telefone deve ter no máximo 20 caracteres' })
  telefone?: string;

  @ApiPropertyOptional({ description: 'Alias phone' })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Morada', example: 'Luanda, Talatona' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'address must be a string' })
  @MinLength(5, { message: 'morada deve ter pelo menos 5 caracteres' })
  @MaxLength(500, { message: 'morada deve ter no máximo 500 caracteres' })
  morada?: string;

  @ApiPropertyOptional({ description: 'Alias address' })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;

  get nomeNormalized(): string | undefined {
    const v = this.nome ?? this.name;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get emailNormalized(): string | undefined {
    const v = this.email ?? this.contactEmail ?? this.email_contacto;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get telefoneNormalized(): string | undefined {
    const v = this.telefone ?? this.phone;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get moradaNormalized(): string | undefined {
    const v = this.morada ?? this.address;
    return v && v.trim().length ? v.trim() : undefined;
  }
}
