import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private parseExpiresToSeconds(value: string): number {
    const m = value.match(/^(\d+)([smhd])$/);
    if (!m) return 7 * 24 * 3600;
    const n = parseInt(m[1] as string, 10);
    const unit = m[2] as string;
    const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (mult[unit] ?? 86400);
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  private async signTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const secret = this.config.get<string>('jwt.secret') as string;
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    const expiresIn = this.config.get<string>('jwt.expiresIn') as string;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;

    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(payload, { secret, expiresIn } as Record<string, unknown>),
      this.jwt.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      } as Record<string, unknown>),
    ]);

    return { access_token, refresh_token };
  }

  private refreshKey(jtiOrToken: string): string {
    const hash = crypto.createHash('sha256').update(jtiOrToken).digest('hex');
    return `blacklist:refresh:${hash}`;
  }

  private resetKey(hash: string): string {
    return `reset:password:${hash}`;
  }

  // ── Register ────────────────────────────────────────────────

  async register(name: string, email: string, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException({
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'This email is already registered' },
      });
    }

    const passwordHash = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'BUYER' as any,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return user;
  }

  // keep legacy alias for backward compatibility
  async registar(nome: string, email: string, password: string) {
    return this.register(nome, email, password);
  }

  // ── Login ───────────────────────────────────────────────────

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is deactivated' },
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const tokens = await this.signTokens(user);
    return tokens;
  }

  // ── Refresh ─────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;

    const blKey = this.refreshKey(refreshToken);
    const blacklisted = await this.redis.exists(blKey);
    if (blacklisted) {
      throw new UnauthorizedException({
        error: { code: 'REVOKED_TOKEN', message: 'Refresh token revoked (logout)' },
      });
    }

    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'User not found or inactive' },
      });
    }

    const ttl = this.parseExpiresToSeconds(refreshExpiresIn);
    await this.redis.set(blKey, '1', ttl);

    const tokens = await this.signTokens(user);
    return tokens;
  }

  // ── Logout ──────────────────────────────────────────────────

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException({
        error: { code: 'BAD_REQUEST', message: 'refresh_token is required' },
      });
    }

    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    try {
      await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;
    const ttl = this.parseExpiresToSeconds(refreshExpiresIn);
    const blKey = this.refreshKey(refreshToken);
    await this.redis.set(blKey, '1', ttl);

    return { message: 'Session terminated successfully' };
  }

  // ── Forgot password ────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const key = this.resetKey(hash);

      await this.redis.set(key, user.id, 15 * 60);

      const resetLink = `http://localhost:${this.config.get('port') ?? 3001}/reset-password?token=${rawToken}`;
      this.logger.log(`[RESET PASSWORD] email=${email} link=${resetLink} hash=${hash}`);
      this.logger.log(`   Token raw (para testes): ${rawToken}`);
      console.log(`\n🔑 [RESET PASSWORD] Link para ${email}: ${resetLink}\n`);
    } else {
      this.logger.log(`[RESET PASSWORD] pedido para email inexistente: ${email}`);
    }

    return {
      message: 'If the email exists, a reset link has been sent',
    };
  }

  async esqueciPassword(email: string) {
    return this.forgotPassword(email);
  }

  // ── Reset password ──────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = this.resetKey(hash);
    const userId = await this.redis.get(key);

    if (!userId) {
      throw new BadRequestException({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Invalid or expired token (15min)',
        },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(key);

    return { message: 'Password reset successfully' };
  }

  async redefinirPassword(token: string, novaPassword: string) {
    return this.resetPassword(token, novaPassword);
  }

  // ── Profile ──────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        isActive: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    return user;
  }

  async getPerfil(compradorId: string) {
    return this.getProfile(compradorId);
  }

  async updateProfile(userId: string, data: { name?: string; email?: string }) {
    if (data.email) {
      const other = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (other && other.id !== userId) {
        throw new ConflictException({
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'This email is already registered' },
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.email ? { email: data.email } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async atualizarPerfil(compradorId: string, dados: { nome?: string; email?: string }) {
    return this.updateProfile(compradorId, { name: dados.nome, email: dados.email });
  }
}
