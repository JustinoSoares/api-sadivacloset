import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Admin name', example: 'Admin Sadiva' })
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

  @ApiPropertyOptional({ description: 'Email', example: 'admin@sadivacloset.local' })
  @IsOptional()
  @Trim()
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Current password (required to change password)',
    example: 'OldPass123!',
  })
  @IsOptional()
  @IsString({ message: 'currentPassword must be a string' })
  @MinLength(6, { message: 'currentPassword must have at least 6 characters' })
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Alias passwordActual' })
  @IsOptional()
  @IsString({ message: 'passwordActual must be a string' })
  @MinLength(6)
  passwordActual?: string;

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

  @ApiPropertyOptional({ description: 'New password', example: 'NewPass123!' })
  @IsOptional()
  @IsString({ message: 'newPassword must be a string' })
  @MinLength(8, { message: 'newPassword must have at least 8 characters' })
  @MaxLength(100, { message: 'newPassword too long' })
  newPassword?: string;

  @ApiPropertyOptional({ description: 'Alias novaPassword' })
  @IsOptional()
  @IsString({ message: 'novaPassword must be a string' })
  @MinLength(8)
  @MaxLength(100)
  novaPassword?: string;

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

  get nameNormalized(): string | undefined {
    const v = this.name ?? this.nome;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get nomeNormalized(): string | undefined {
    return this.nameNormalized;
  }

  get emailNormalized(): string | undefined {
    return this.email && this.email.trim().length ? this.email.trim() : undefined;
  }

  get currentPasswordNormalized(): string | undefined {
    const v =
      this.currentPassword ?? this.passwordActual ?? this.senhaAtual ?? this.password_actual;
    return v && v.length ? v : undefined;
  }

  get passwordActualNormalized(): string | undefined {
    return this.currentPasswordNormalized;
  }

  get newPasswordNormalized(): string | undefined {
    const v = this.newPassword ?? this.novaPassword ?? this.senhaNova ?? this.password;
    return v && v.length ? v : undefined;
  }

  get novaPasswordNormalized(): string | undefined {
    return this.newPasswordNormalized;
  }
}

export class UpdateContaDto extends UpdateAccountDto {}
