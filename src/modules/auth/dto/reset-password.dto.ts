import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @Transform(({ obj }) => obj.newPassword ?? obj.novaPassword)
  @IsString()
  @MinLength(8, { message: 'newPassword deve ter no mínimo 8 caracteres' })
  newPassword!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  novaPassword?: string;
}
