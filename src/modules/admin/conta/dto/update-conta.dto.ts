import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateContaDto {
  @ApiPropertyOptional({ description: 'Nome do admin', example: 'Admin Sadiva' })
  @IsOptional()
  @Trim()
  @IsString({ message: 'nome deve ser texto' })
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

  @ApiPropertyOptional({ description: 'Email', example: 'admin@sadivacloset.local' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email deve ser um email válido' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Password actual (obrigatória se quiser trocar password)',
    example: 'OldPass123!',
  })
  @IsOptional()
  @IsString({ message: 'passwordActual deve ser texto' })
  @MinLength(6, { message: 'passwordActual deve ter pelo menos 6 caracteres' })
  passwordActual?: string;

  @ApiPropertyOptional({ description: 'Alias currentPassword' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Alias senhaAtual' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  senhaAtual?: string;

  @ApiPropertyOptional({ description: 'Alias password_actual' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password_actual?: string;

  @ApiPropertyOptional({ description: 'Nova password', example: 'NewPass123!' })
  @IsOptional()
  @IsString({ message: 'novaPassword deve ser texto' })
  @MinLength(8, { message: 'novaPassword deve ter pelo menos 8 caracteres' })
  @MaxLength(100, { message: 'novaPassword muito longa' })
  novaPassword?: string;

  @ApiPropertyOptional({ description: 'Alias newPassword' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword?: string;

  @ApiPropertyOptional({ description: 'Alias senhaNova' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  senhaNova?: string;

  @ApiPropertyOptional({ description: 'Alias password' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;

  get nomeNormalized(): string | undefined {
    const v = this.nome ?? this.name;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get emailNormalized(): string | undefined {
    return this.email && this.email.trim().length ? this.email.trim() : undefined;
  }

  get passwordActualNormalized(): string | undefined {
    const v =
      this.passwordActual ?? this.currentPassword ?? this.senhaAtual ?? this.password_actual;
    return v && v.length ? v : undefined;
  }

  get novaPasswordNormalized(): string | undefined {
    const v = this.novaPassword ?? this.newPassword ?? this.senhaNova ?? this.password;
    return v && v.length ? v : undefined;
  }
}
