import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegistarDto {
  @IsString()
  @IsNotEmpty({ message: 'nome é obrigatório' })
  nome!: string;

  @IsEmail({}, { message: 'email deve ser um email válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password deve ter no mínimo 8 caracteres' })
  password!: string;
}
