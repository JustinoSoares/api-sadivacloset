import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type AppRole = 'admin' | 'buyer';

// keep legacy alias for backward compatibility
export type LegacyAppRole = 'admin' | 'comprador';

/**
 * Restringe a rota a roles específicos. Requer JwtAuthGuard + RolesGuard.
 * Ex: @Roles('admin') or @Roles('buyer')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
