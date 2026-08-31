import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: any };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; exists: jest.Mock };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let config: { get: jest.Mock };

  const mockUser = {
    id: 'uuid-1',
    name: 'Teste',
    email: 'teste@example.com',
    passwordHash: '$2a$10$hash',
    role: 'BUYER',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    // keep legacy alias for backward compatibility
    (prisma as any).comprador = prisma.user;

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
      verifyAsync: jest.fn(),
    };

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          'jwt.secret': 'jwt-secret-test-1234567890',
          'jwt.refreshSecret': 'refresh-secret-test-1234567890',
          'jwt.expiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
          port: '3001',
        };
        return map[key] as any;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should create user with hash and buyer role (english)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-id',
        name: 'Novo',
        email: 'novo@example.com',
        role: 'BUYER',
        createdAt: new Date(),
      });

      const result = await service.register('Novo', 'novo@example.com', 'password123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'novo@example.com' } });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'novo@example.com', role: 'BUYER' }),
        }),
      );
      expect(result.email).toBe('novo@example.com');
    });

    it('legacy registar alias should still work', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-id',
        name: 'Novo',
        email: 'novo@example.com',
        role: 'BUYER',
        createdAt: new Date(),
      });
      const result = await service.registar('Novo', 'novo@example.com', 'password123');
      expect(result.email).toBe('novo@example.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(
        service.register('Teste', 'teste@example.com', 'password123'),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.register('Teste', 'teste@example.com', 'password123'),
      ).rejects.toMatchObject({
        response: { error: { code: 'EMAIL_ALREADY_EXISTS' } },
      });
    });
  });

  describe('login', () => {
    it('should return tokens when credentials valid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jwt.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

      const tokens = await service.login('teste@example.com', 'password123');
      expect(tokens).toEqual({ access_token: 'access', refresh_token: 'refresh' });
    });

    it('should throw Unauthorized if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nao@existe.com', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should throw Unauthorized if account inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login('teste@example.com', 'x')).rejects.toMatchObject({
        response: { error: { code: 'ACCOUNT_INACTIVE' } },
      });
    });

    it('should throw Unauthorized if password invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      await expect(service.login('teste@example.com', 'wrong')).rejects.toMatchObject({
        response: { error: { code: 'INVALID_CREDENTIALS' } },
      });
    });
  });

  describe('refresh', () => {
    const refreshToken = 'refresh-jwt-token';

    it('should rotate tokens when refresh valid', async () => {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      redis.exists.mockResolvedValue(false);
      jwt.verifyAsync.mockResolvedValue({ sub: mockUser.id, email: mockUser.email, role: 'BUYER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');

      const result = await service.refresh(refreshToken);
      expect(redis.exists).toHaveBeenCalledWith(`blacklist:refresh:${hash}`);
      expect(redis.set).toHaveBeenCalledWith(`blacklist:refresh:${hash}`, '1', expect.any(Number));
      expect(result).toEqual({ access_token: 'new-access', refresh_token: 'new-refresh' });
    });

    it('should reject if token is blacklisted', async () => {
      redis.exists.mockResolvedValue(true);
      await expect(service.refresh(refreshToken)).rejects.toMatchObject({
        response: { error: { code: 'REVOKED_TOKEN' } },
      });
    });

    it('should reject if verify fails', async () => {
      redis.exists.mockResolvedValue(false);
      jwt.verifyAsync.mockRejectedValue(new Error('invalid'));
      await expect(service.refresh('bad')).rejects.toMatchObject({
        response: { error: { code: 'INVALID_TOKEN' } },
      });
    });

    it('should reject if user not found', async () => {
      redis.exists.mockResolvedValue(false);
      jwt.verifyAsync.mockResolvedValue({ sub: 'nao-existe', email: 'a', role: 'BUYER' });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.refresh(refreshToken)).rejects.toMatchObject({
        response: { error: { code: 'UNAUTHENTICATED' } },
      });
    });
  });

  describe('logout', () => {
    it('should blacklist refresh token', async () => {
      const token = 'valid-refresh';
      jwt.verifyAsync.mockResolvedValue({ sub: 'id' });
      const result = await service.logout(token);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:refresh:'),
        '1',
        expect.any(Number),
      );
      expect(result).toEqual({ message: 'Session terminated successfully' });
    });

    it('should throw BadRequest if token empty', async () => {
      await expect(service.logout('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw Unauthorized if token invalid', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad'));
      await expect(service.logout('invalid')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should generate token and save hash in Redis when email exists (english)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.forgotPassword('teste@example.com');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('reset:password:'),
        mockUser.id,
        15 * 60,
      );
      expect(result).toEqual({
        message: 'If the email exists, a reset link has been sent',
      });
    });

    it('legacy esqueciPassword alias should still work', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.esqueciPassword('teste@example.com');
      expect(redis.set).toHaveBeenCalled();
      expect(result.message).toContain('If the email exists');
    });

    it('should return generic message when email not exists (not enumerate)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('nao@existe.com');
      expect(redis.set).not.toHaveBeenCalled();
      expect(result.message).toContain('If the email exists');
    });
  });

  describe('resetPassword', () => {
    it('should update password and invalidate token (english)', async () => {
      const raw = 'raw-token-123';
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const key = `reset:password:${hash}`;
      redis.get.mockResolvedValue(mockUser.id);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ id: mockUser.id });

      const result = await service.resetPassword(raw, 'novaPassword123');
      expect(redis.get).toHaveBeenCalledWith(key);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
      expect(redis.del).toHaveBeenCalledWith(key);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('legacy redefinirPassword alias should work', async () => {
      const raw = 'raw-token-123';
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const key = `reset:password:${hash}`;
      redis.get.mockResolvedValue(mockUser.id);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ id: mockUser.id });
      const result = await service.redefinirPassword(raw, 'novaPassword123');
      expect(result.message).toBe('Password reset successfully');
    });

    it('should throw BadRequest if token expired', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.resetPassword('bad', 'nova12345')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.resetPassword('bad', 'nova12345')).rejects.toMatchObject({
        response: { error: { code: 'TOKEN_EXPIRED' } },
      });
    });

    it('should throw NotFound if user of token not exists', async () => {
      redis.get.mockResolvedValue('id-qualquer');
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('raw', 'nova12345')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('profile', () => {
    it('getProfile should return data (english)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.getProfile(mockUser.id);
      expect(result.id).toBe(mockUser.id);
    });

    it('legacy getPerfil alias should work', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.getPerfil(mockUser.id);
      expect(result.id).toBe(mockUser.id);
    });

    it('getProfile should throw NotFound if not exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('no-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateProfile should check email conflict', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'outro-id', email: 'taken@example.com' });
      await expect(
        service.updateProfile(mockUser.id, { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('legacy atualizarPerfil alias with nome should work', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ id: mockUser.id, name: 'Novo Nome' });
      const result = await service.atualizarPerfil(mockUser.id, { nome: 'Novo Nome' } as any);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockUser.id }, data: { name: 'Novo Nome' } }),
      );
      expect((result as any).name).toBe('Novo Nome');
    });

    it('updateProfile should update name (english)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ id: mockUser.id, name: 'New Name' });
      const result = await service.updateProfile(mockUser.id, { name: 'New Name' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockUser.id }, data: { name: 'New Name' } }),
      );
      expect(result.name).toBe('New Name');
    });

    it('updateProfile should allow same email (own)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: mockUser.id, email: 'teste@example.com' });
      prisma.user.update.mockResolvedValue({ id: mockUser.id, email: 'teste@example.com' });
      const result = await service.updateProfile(mockUser.id, { email: 'teste@example.com' });
      expect(result.email).toBe('teste@example.com');
    });
  });

  describe('parseExpiresToSeconds helper via refresh TTL', () => {
    it('should use TTL 7d = 604800', async () => {
      const token = 'tok';
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      redis.exists.mockResolvedValue(false);
      jwt.verifyAsync.mockResolvedValue({ sub: mockUser.id, email: mockUser.email, role: 'BUYER' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.signAsync.mockResolvedValue('x');
      await service.refresh(token);
      expect(redis.set).toHaveBeenCalledWith(`blacklist:refresh:${hash}`, '1', 7 * 24 * 3600);
    });
  });
});
