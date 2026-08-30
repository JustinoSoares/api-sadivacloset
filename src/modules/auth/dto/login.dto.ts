import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email', example: 'maria@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'User password', example: 'StrongPass123' })
  @IsString()
  @MinLength(1)
  password!: string;
}
