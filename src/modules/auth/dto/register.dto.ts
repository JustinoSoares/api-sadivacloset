import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User name', example: 'Maria Silva' })
  @Transform(({ obj }) => obj.name ?? obj.nome)
  @IsString()
  @IsNotEmpty({ message: 'name é obrigatório' })
  name!: string;

  // legacy alias, not validated directly
  @ApiPropertyOptional({ description: 'Legacy alias nome' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiProperty({ description: 'User email', example: 'maria@example.com' })
  @IsEmail({}, { message: 'email deve ser um email válido' })
  email!: string;

  @ApiProperty({ description: 'User password (min 8 chars)', example: 'StrongPass123' })
  @IsString()
  @MinLength(8, { message: 'password deve ter no mínimo 8 caracteres' })
  password!: string;
}
