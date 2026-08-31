import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface JwtPayload {
  sub: string; // comprador id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: JwtPayload;
    }>();

    const token = this.extractToken(request.headers);
    if (!token) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Token not provided' },
      });
    }

    try {
      const secret = this.configService.get<string>('jwt.secret') as string;
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
      (request as Record<string, unknown>).user = payload;
      return true;
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.name === 'TokenExpiredError'
          ? 'Token expired'
          : 'Invalid token';
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: msg },
      });
    }
  }

  private extractToken(headers: Record<string, string | undefined>): string | null {
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') return parts[1] as string;
    return null;
  }
}
