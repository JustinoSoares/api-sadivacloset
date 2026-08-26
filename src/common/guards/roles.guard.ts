import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator';
import type { JwtPayload } from './jwt-auth.guard';

function normalizeRole(role: string): string {
  const lower = role.toLowerCase();
  if (lower === 'comprador' || lower === 'buyer') return 'buyer';
  if (lower === 'admin') return 'admin';
  return lower;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requestUrl = context.switchToHttp().getRequest<{ url?: string }>().url ?? '';
    const isAdminPath = requestUrl.startsWith('/api/v1/admin') || requestUrl.startsWith('/admin');

    const effectiveRoles = requiredRoles ?? (isAdminPath ? (['admin'] as AppRole[]) : null);

    if (!effectiveRoles || effectiveRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        erro: { codigo: 'ACESSO_NEGADO', mensagem: 'Utilizador não autenticado' },
      });
    }

    const userRole = normalizeRole(user.role);
    const normalizedRequired = effectiveRoles.map((r) => normalizeRole(r as string));

    if (!normalizedRequired.includes(userRole)) {
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
