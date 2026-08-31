import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User name', example: 'Maria Silva' })
  @Transform(({ obj }) => obj.name ?? obj.nome)
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiProperty({ description: 'User email', example: 'maria@example.com' })
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @ApiProperty({ description: 'User password (min 8 chars)', example: 'StrongPass123' })
  @IsString()
  @MinLength(8, { message: 'password must have at least 8 characters' })
  password!: string;
}
