import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AtualizarPerfilDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
