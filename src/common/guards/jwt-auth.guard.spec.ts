import { JwtAuthGuard } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwt: { verifyAsync: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwt = { verifyAsync: jest.fn() };
    config = { get: jest.fn().mockReturnValue('secret-test') };

    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  function createContext(
    headers: Record<string, string | undefined>,
    isPublic = false,
  ): { ctx: ExecutionContext; request: any } {
    reflector.getAllAndOverride.mockReturnValue(isPublic);
    const request: any = { headers, user: undefined };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { ctx, request };
  }

  it('deve permitir rota @Public() sem token', async () => {
    const { ctx } = createContext({}, true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('deve rejeitar quando token não fornecido', async () => {
    const { ctx } = createContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    const { ctx: ctx2 } = createContext({});
    await expect(guard.canActivate(ctx2)).rejects.toMatchObject({
      response: { error: { code: 'UNAUTHENTICATED' } },
    });
  });

  it('deve rejeitar quando token inválido', async () => {
    const { ctx } = createContext({ authorization: 'Bearer invalid' });
    jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { error: { code: 'UNAUTHENTICATED' } },
    });
  });

  it('deve rejeitar com Token expired quando TokenExpiredError', async () => {
    const { ctx } = createContext({ authorization: 'Bearer expired' });
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    jwt.verifyAsync.mockRejectedValue(err);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: { error: { message: 'Token expired' } },
    });
  });

  it('deve validar e injetar user no request quando token válido', async () => {
    const { ctx, request } = createContext({ authorization: 'Bearer valid' });
    const payload = { sub: '123', email: 'a@b.com', role: 'comprador' };
    jwt.verifyAsync.mockResolvedValue(payload);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(payload);
  });

  it('deve extrair token de Authorization Bearer', async () => {
    const { ctx } = createContext({ authorization: 'Bearer tok123' });
    jwt.verifyAsync.mockResolvedValue({ sub: '1', email: 'a', role: 'admin' });
    await guard.canActivate(ctx);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('tok123', { secret: 'secret-test' });
  });
});
