import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google ID token (JWT) obtido via Google Identity Services (GIS) no frontend. Envie o `credential` retornado por `google.accounts.id.initialize` callback.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxMjM0NTYtYWJjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMTIzNDU2LWFiYy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjEwMDM5MDIwMzQ4MDU1Mzk5MDIzNCIsImVtYWlsIjoibWFyaWFAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Ik1hcmlhIFNpbHZhIiwicGljdHVyZSI6Imh0dHBzOi8vL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS0ifQ.SIGNATURE',
  })
  @IsOptional()
  @IsString({ message: 'id_token deve ser uma string' })
  @IsNotEmpty({ message: 'id_token não pode estar vazio' })
  @Transform(({ obj }) => obj.id_token ?? obj.idToken ?? obj.credential ?? obj.token)
  id_token?: string;

  @ApiPropertyOptional({
    description: 'Alias para id_token (aceita idToken ou credential). Use um dos campos.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Alias credential (Google GIS retorna {credential})',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  credential?: string;

  @ApiPropertyOptional({
    description: 'Access token Google (alternativa). Se enviar access_token, será validado via https://www.googleapis.com/oauth2/v3/userinfo. Prefira id_token.',
    example: 'ya29.a0AfH6SMB...',
  })
  @IsOptional()
  @IsString()
  access_token?: string;

  @ApiPropertyOptional({ description: 'Alias accessToken' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  // normalizado
  get idTokenNormalized(): string | undefined {
    const v = this.id_token ?? this.idToken ?? this.credential ?? (this as any).token;
    if (!v) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
  }

  get accessTokenNormalized(): string | undefined {
    const v = this.access_token ?? this.accessToken;
    if (!v) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
  }
}
