import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class RedefinirPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'novaPassword deve ter no mínimo 8 caracteres' })
  novaPassword!: string;
}
