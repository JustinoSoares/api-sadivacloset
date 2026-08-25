import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca a rota como pública — JwtAuthGuard ignora autenticação.
 * Ex: @Public() em POST /auth/login
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
