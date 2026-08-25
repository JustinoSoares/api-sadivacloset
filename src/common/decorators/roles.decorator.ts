import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type AppRole = 'admin' | 'comprador';

/**
 * Restringe a rota a roles específicos. Requer JwtAuthGuard + RolesGuard.
 * Ex: @Roles('admin')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
