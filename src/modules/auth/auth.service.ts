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
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
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
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado. Use outro e-mail ou faça login.' },
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

    // Notificação de boas-vindas (também emite via WebSocket /realtime)
    try {
      await this.notificationsService.create(
        user.id,
        'Bem-vindo à SadivaCloset! 🎉',
        `Olá ${user.name}, sua conta foi criada com sucesso. Explore nosso catálogo e encontre peças incríveis para você. Boas compras!`,
      );
    } catch (e) {
      this.logger.warn(`Falha ao criar notificação de boas-vindas para ${user.id}: ${(e as Error).message}`);
    }

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
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.' },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        error: { code: 'ACCOUNT_INACTIVE', message: 'Sua conta está desativada. Entre em contato com o suporte.' },
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.' },
      });
    }

    const tokens = await this.signTokens(user);
    return tokens;
  }

  // ── Google Login (token based) ──────────────────────────────
  async googleLogin(idToken?: string, accessToken?: string) {
    if (!idToken && !accessToken) {
      throw new BadRequestException({
        error: { code: 'GOOGLE_TOKEN_MISSING', message: 'Informe o id_token (credential) do Google ou access_token.' },
      });
    }

    let googleUser: { email: string; name: string; sub: string; picture?: string; email_verified?: boolean } | null = null;

    // 1) id_token via tokeninfo (recomendado - GIS retorna credential)
    if (idToken) {
      try {
        const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`tokeninfo ${res.status}: ${txt}`);
        }
        const data: any = await res.json();
        // data: {iss, azp, aud, sub, email, email_verified, name, picture, given_name, family_name, exp, iat}
        const allowedIds = (this.config.get<string>('google.clientIds') as unknown as string[]) ?? [];
        // fallback para config google.clientId / env
        const singleId = this.config.get<string>('google.clientId') ?? process.env.GOOGLE_CLIENT_ID ?? '';
        const allAllowed = [...allowedIds, singleId].filter(Boolean);
        if (allAllowed.length > 0 && data.aud && !allAllowed.includes(data.aud)) {
          // também aceita azp
          if (!allAllowed.includes(data.azp)) {
            throw new UnauthorizedException({
              error: { code: 'GOOGLE_AUD_MISMATCH', message: 'Token Google não foi emitido para este app. Verifique GOOGLE_CLIENT_ID.' },
            });
          }
        }
        const issOk = data.iss === 'https://accounts.google.com' || data.iss === 'accounts.google.com';
        if (!issOk) {
          throw new UnauthorizedException({
            error: { code: 'GOOGLE_ISS_INVALID', message: 'Token Google com emissor inválido.' },
          });
        }
        if (data.email_verified !== 'true' && data.email_verified !== true) {
          // alguns tokens retornam string "true"
          this.logger.warn(`Google email_verified != true para ${data.email}`);
        }
        if (!data.email) {
          throw new UnauthorizedException({
            error: { code: 'GOOGLE_EMAIL_MISSING', message: 'Token Google sem e-mail.' },
          });
        }
        googleUser = {
          email: String(data.email).toLowerCase().trim(),
          name: String(data.name ?? data.given_name ?? data.email.split('@')[0]),
          sub: String(data.sub),
          picture: data.picture ? String(data.picture) : undefined,
          email_verified: data.email_verified === true || data.email_verified === 'true',
        };
      } catch (e: any) {
        if (e instanceof UnauthorizedException) throw e;
        this.logger.warn(`Falha ao verificar Google id_token: ${e.message}`);
        throw new UnauthorizedException({
          error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Token Google inválido ou expirado. Tente fazer login novamente.' },
        });
      }
    } else if (accessToken) {
      // 2) access_token via userinfo
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`userinfo ${res.status}: ${txt}`);
        }
        const data: any = await res.json(); // {sub, email, email_verified, name, picture}
        if (!data.email) {
          throw new UnauthorizedException({
            error: { code: 'GOOGLE_EMAIL_MISSING', message: 'Token Google sem e-mail.' },
          });
        }
        googleUser = {
          email: String(data.email).toLowerCase().trim(),
          name: String(data.name ?? data.email.split('@')[0]),
          sub: String(data.sub),
          picture: data.picture ? String(data.picture) : undefined,
          email_verified: data.email_verified === true,
        };
      } catch (e: any) {
        if (e instanceof UnauthorizedException) throw e;
        this.logger.warn(`Falha ao verificar Google access_token: ${e.message}`);
        throw new UnauthorizedException({
          error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Token Google inválido ou expirado.' },
        });
      }
    }

    if (!googleUser) {
      throw new UnauthorizedException({
        error: { code: 'GOOGLE_TOKEN_INVALID', message: 'Não foi possível validar o token Google.' },
      });
    }

    // 3) Busca ou cria usuário local
    let user = await this.prisma.user.findUnique({ where: { email: googleUser.email } });
    let isNew = false;
    if (!user) {
      const randomPass = crypto.randomBytes(32).toString('hex');
      const passwordHash = await this.hashPassword(randomPass);
      user = await this.prisma.user.create({
        data: {
          name: googleUser.name,
          email: googleUser.email,
          passwordHash,
          role: 'BUYER' as any,
          isActive: true,
        },
      });
      isNew = true;
      this.logger.log(`Usuário criado via Google: ${user.email} (${user.id})`);
      try {
        await this.notificationsService.create(
          user.id,
          'Bem-vindo à SadivaCloset! 🎉',
          `Olá ${user.name}, sua conta foi criada via Google com sucesso. Bem-vindo!`,
        );
      } catch (e) {
        this.logger.warn(`Falha notificação boas-vindas Google ${user.id}: ${(e as Error).message}`);
      }
    } else {
      if (!user.isActive) {
        throw new UnauthorizedException({
          error: { code: 'ACCOUNT_INACTIVE', message: 'Sua conta está desativada. Entre em contato com o suporte.' },
        });
      }
      // Opcional: atualiza nome se mudou no Google
      if (googleUser.name && googleUser.name !== user.name) {
        try {
          user = await this.prisma.user.update({ where: { id: user.id }, data: { name: googleUser.name } });
        } catch {}
      }
    }

    const tokens = await this.signTokens(user);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      isNew,
      google: { sub: googleUser.sub, picture: googleUser.picture },
    };
  }

  // ── Refresh ─────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;

    const blKey = this.refreshKey(refreshToken);
    const blacklisted = await this.redis.exists(blKey);
    if (blacklisted) {
      throw new UnauthorizedException({
        error: { code: 'REVOKED_TOKEN', message: 'Sessão encerrada. Faça login novamente.' },
      });
    }

    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: 'Sessão inválida ou expirada. Faça login novamente.' },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHENTICATED', message: 'Usuário não encontrado ou inativo. Faça login novamente.' },
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
        error: { code: 'BAD_REQUEST', message: 'O campo refresh_token é obrigatório.' },
      });
    }

    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    try {
      await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: 'Sessão inválida ou expirada. Faça login novamente.' },
      });
    }

    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;
    const ttl = this.parseExpiresToSeconds(refreshExpiresIn);
    const blKey = this.refreshKey(refreshToken);
    await this.redis.set(blKey, '1', ttl);

    return { message: 'Sessão encerrada com sucesso.' };
  }

  // ── Forgot password ────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const key = this.resetKey(hash);

      await this.redis.set(key, user.id, 15 * 60);

      const frontendUrl = (this.config.get<string>('frontendUrl') ??
        this.config.get<string>('FRONTEND_URL') ??
        `http://localhost:${this.config.get('port') ?? 3001}`) as string;
      // Normaliza sem trailing slash
      const baseUrl = frontendUrl.replace(/\/$/, '');
      const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

      this.logger.log(`[RESET PASSWORD] email=${email} link=${resetLink} hash=${hash}`);
      this.logger.log(`   Token raw (para testes): ${rawToken}`);
      console.log(`\n🔑 [RESET PASSWORD] Link para ${email}: ${resetLink}\n`);

      // Envia e-mail real se SMTP configurado; senão apenas loga (fallback dev)
      try {
        await this.mailService.sendPasswordResetEmail(email, resetLink, user.name);
      } catch (err) {
        this.logger.error(`Falha ao enviar e-mail de reset para ${email}: ${(err as Error).message}`);
        // Não quebra o fluxo — mantém resposta genérica para evitar enumeration
      }
    } else {
      this.logger.log(`[RESET PASSWORD] pedido para email inexistente: ${email}`);
    }

    return {
      message: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação em instantes.',
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
          message: 'Link inválido ou expirado (15 minutos). Solicite um novo link de recuperação.',
        },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
      });
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(key);

    return { message: 'Senha redefinida com sucesso. Faça login com sua nova senha.' };
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
        error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
      });
    }

    // Enriquecimento: endereço padrão + zona de entrega (evita requisição extra no frontend)
    const defaultAddress = await this.prisma.address.findFirst({
      where: { buyerId: userId, isDefault: true },
    });
    let defaultDeliveryZone: { id: string; neighborhood: string; price: number } | null = null;
    let defaultAddressEnriched: any = defaultAddress ? { ...defaultAddress } : null;
    if (defaultAddress) {
      const zone = await this.prisma.deliveryZone.findUnique({
        where: { neighborhood: defaultAddress.neighborhood },
      });
      if (zone) {
        defaultDeliveryZone = { id: zone.id, neighborhood: zone.neighborhood, price: zone.price };
        defaultAddressEnriched.deliveryZone = defaultDeliveryZone;
      } else {
        // fallback para taxa padrão do admin
        const prefs = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
        if (prefs) {
          defaultDeliveryZone = { id: 'default', neighborhood: defaultAddress.neighborhood, price: prefs.defaultDeliveryFee };
          defaultAddressEnriched.deliveryZone = defaultDeliveryZone;
        }
      }
    }

    return {
      ...user,
      defaultAddress: defaultAddressEnriched,
      defaultDeliveryZone,
    };
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
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Este e-mail já está cadastrado. Use outro e-mail ou faça login.' },
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
