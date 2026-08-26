import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @Transform(({ obj }) => obj.name ?? obj.nome)
  @IsString()
  @IsNotEmpty({ message: 'name é obrigatório' })
  name!: string;

  // legacy alias, not validated directly
  @IsOptional()
  @IsString()
  nome?: string;

  @IsEmail({}, { message: 'email deve ser um email válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password deve ter no mínimo 8 caracteres' })
  password!: string;
}
