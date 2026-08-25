import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import type { JwtPayload } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Auto-protege qualquer rota /admin/* exigindo role admin, mesmo sem @Roles explícito
    const requestUrl = context.switchToHttp().getRequest<{ url?: string }>().url ?? '';
    const isAdminPath = requestUrl.startsWith('/api/v1/admin') || requestUrl.startsWith('/admin');

    const effectiveRoles = requiredRoles ?? (isAdminPath ? (['admin'] as AppRole[]) : null);

    // Sem @Roles e não é rota admin => libera (apenas autenticação já verificada pelo JwtAuthGuard)
    if (!effectiveRoles || effectiveRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Utilizador não autenticado' },
      });
    }

    if (!effectiveRoles.includes(user.role as AppRole)) {
      throw new ForbiddenException({
        erro: {
          codigo: 'ACESSO_NEGADO',
          mensagem: 'Sem permissão para aceder a este recurso',
        },
      });
    }

    return true;
  }
}
