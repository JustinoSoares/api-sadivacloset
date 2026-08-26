import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  function ctxWith(url: string, user?: any, requiredRoles?: any) {
    reflector.getAllAndOverride.mockReturnValue(requiredRoles);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ url, user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  it('deve liberar quando sem @Roles e não é rota admin', () => {
    const ctx = ctxWith('/api/v1/produtos', { role: 'comprador' }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve bloquear rota /admin sem role admin (auto-protege)', () => {
    const ctx = ctxWith('/api/v1/admin/produtos', { role: 'comprador' }, undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('deve permitir admin em rota /admin', () => {
    const ctx = ctxWith('/api/v1/admin/produtos', { role: 'admin' }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve respeitar @Roles quando definido', () => {
    const ctx = ctxWith('/api/v1/qualquer', { role: 'comprador' }, ['admin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          erro: expect.objectContaining({ codigo: 'ACESSO_NEGADO' }),
        }),
      }),
    );
  });

  it('deve permitir quando role corresponde', () => {
    const ctx = ctxWith('/api/v1/admin/ping', { role: 'admin' }, ['admin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deve lançar Forbidden quando sem user', () => {
    const ctx = ctxWith('/api/v1/admin/ping', undefined, ['admin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
