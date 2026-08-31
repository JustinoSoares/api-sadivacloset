import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'User name', example: 'Maria Silva' })
  @Transform(({ obj }) => obj.name ?? obj.nome)
  @IsOptional()
  @IsString()
  name?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'User email', example: 'maria@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
