import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token', example: 'abc123-token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (min 8 chars)', example: 'NewStrongPass123' })
  @Transform(({ obj }) => obj.newPassword ?? obj.novaPassword)
  @IsString()
  @MinLength(8, { message: 'newPassword deve ter no mínimo 8 caracteres' })
  newPassword!: string;

  @ApiPropertyOptional({ description: 'Legacy alias novaPassword' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  novaPassword?: string;
}
