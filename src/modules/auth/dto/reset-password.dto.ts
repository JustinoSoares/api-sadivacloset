import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token', example: 'abc123-token' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (min 8 chars)', example: 'NewStrongPass123' })
  @Transform(({ obj }) => obj.newPassword ?? obj.novaPassword)
  @IsString()
  @MinLength(8, { message: 'newPassword must have at least 8 characters' })
  newPassword!: string;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MinLength(8)
  novaPassword?: string;
}
