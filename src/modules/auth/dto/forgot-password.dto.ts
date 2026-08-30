import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email', example: 'maria@example.com' })
  @IsEmail()
  email!: string;
}
