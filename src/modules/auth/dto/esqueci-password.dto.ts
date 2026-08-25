import { IsEmail } from 'class-validator';

export class EsqueciPasswordDto {
  @IsEmail()
  email!: string;
}
