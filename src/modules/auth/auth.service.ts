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

  // ── Helpers ─────────────────────────────────────────────────

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

  private async signTokens(comprador: { id: string; email: string; role: string }) {
    const payload = { sub: comprador.id, email: comprador.email, role: comprador.role };
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
    // Usa hash do token para chave curta (evita guardar token gigante)
    const hash = crypto.createHash('sha256').update(jtiOrToken).digest('hex');
    return `blacklist:refresh:${hash}`;
  }

  private resetKey(hash: string): string {
    return `reset:password:${hash}`;
  }

  // ── Registar ────────────────────────────────────────────────

  async registar(nome: string, email: string, password: string) {
    const exists = await this.prisma.comprador.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException({
        erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Este email já está registado' },
      });
    }

    const passwordHash = await this.hashPassword(password);

    const comprador = await this.prisma.comprador.create({
      data: {
        nome,
        email,
        passwordHash,
        role: 'comprador',
      },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });

    return comprador;
  }

  // ── Login ───────────────────────────────────────────────────

  async login(email: string, password: string) {
    const comprador = await this.prisma.comprador.findUnique({ where: { email } });
    if (!comprador) {
      throw new UnauthorizedException({
        erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'Email ou password inválidos' },
      });
    }

    if (!comprador.ativo) {
      throw new UnauthorizedException({
        erro: { codigo: 'CONTA_INATIVA', mensagem: 'Conta desativada' },
      });
    }

    const ok = await bcrypt.compare(password, comprador.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'Email ou password inválidos' },
      });
    }

    const tokens = await this.signTokens(comprador);
    return tokens;
  }

  // ── Refresh ─────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;

    // Blacklist check
    const blKey = this.refreshKey(refreshToken);
    const blacklisted = await this.redis.exists(blKey);
    if (blacklisted) {
      throw new UnauthorizedException({
        erro: { codigo: 'TOKEN_REVOGADO', mensagem: 'Refresh token revogado (logout)' },
      });
    }

    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Refresh token inválido ou expirado' },
      });
    }

    const comprador = await this.prisma.comprador.findUnique({
      where: { id: payload.sub },
    });
    if (!comprador || !comprador.ativo) {
      throw new UnauthorizedException({
        erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Utilizador não encontrado ou inativo' },
      });
    }

    // Rotação: invalida o refresh antigo (blacklist com TTL = validade do refresh)
    const ttl = this.parseExpiresToSeconds(refreshExpiresIn);
    await this.redis.set(blKey, '1', ttl);

    const tokens = await this.signTokens(comprador);
    return tokens;
  }

  // ── Logout ──────────────────────────────────────────────────

  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException({
        erro: { codigo: 'PEDIDO_INVALIDO', mensagem: 'refresh_token é obrigatório' },
      });
    }

    // Valida formato do token antes de blacklistar (evita enchente)
    const refreshSecret = this.config.get<string>('jwt.refreshSecret') as string;
    try {
      await this.jwt.verifyAsync(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException({
        erro: { codigo: 'TOKEN_INVALIDO', mensagem: 'Refresh token inválido ou expirado' },
      });
    }

    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') as string;
    const ttl = this.parseExpiresToSeconds(refreshExpiresIn);
    const blKey = this.refreshKey(refreshToken);
    await this.redis.set(blKey, '1', ttl);

    return { mensagem: 'Sessão terminada com sucesso' };
  }

  // ── Esqueci password ────────────────────────────────────────

  async esqueciPassword(email: string) {
    const comprador = await this.prisma.comprador.findUnique({ where: { email } });

    // Resposta genérica para não enumerar emails — mas se existir, cria token
    if (comprador) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const key = this.resetKey(hash);

      // Guarda hash do token + compradorId com TTL 15min
      await this.redis.set(key, comprador.id, 15 * 60);

      const resetLink = `http://localhost:${this.config.get('port') ?? 3001}/redefinir-password?token=${rawToken}`;
      // Por agora loga em vez de enviar email
      this.logger.log(`[RESET PASSWORD] email=${email} link=${resetLink} hash=${hash}`);
      this.logger.log(`   Token raw (para testes): ${rawToken}`);
      console.log(`\n🔑 [RESET PASSWORD] Link para ${email}: ${resetLink}\n`);
    } else {
      this.logger.log(`[RESET PASSWORD] pedido para email inexistente: ${email}`);
    }

    return {
      mensagem: 'Se o email existir, um link de redefinição foi enviado',
    };
  }

  // ── Redefinir password ──────────────────────────────────────

  async redefinirPassword(token: string, novaPassword: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const key = this.resetKey(hash);
    const compradorId = await this.redis.get(key);

    if (!compradorId) {
      throw new BadRequestException({
        erro: {
          codigo: 'TOKEN_EXPIRADO',
          mensagem: 'Token inválido ou expirado (15min)',
        },
      });
    }

    const comprador = await this.prisma.comprador.findUnique({
      where: { id: compradorId },
    });
    if (!comprador) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Utilizador não encontrado' },
      });
    }

    const passwordHash = await this.hashPassword(novaPassword);
    await this.prisma.comprador.update({
      where: { id: compradorId },
      data: { passwordHash },
    });

    // Invalida token após uso
    await this.redis.del(key);

    return { mensagem: 'Password redefinida com sucesso' };
  }

  // ── Perfil ──────────────────────────────────────────────────

  async getPerfil(compradorId: string) {
    const comprador = await this.prisma.comprador.findUnique({
      where: { id: compradorId },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        criadoEm: true,
        ativo: true,
      },
    });
    if (!comprador) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Utilizador não encontrado' },
      });
    }
    return comprador;
  }

  async atualizarPerfil(compradorId: string, dados: { nome?: string; email?: string }) {
    if (dados.email) {
      const outro = await this.prisma.comprador.findUnique({
        where: { email: dados.email },
      });
      if (outro && outro.id !== compradorId) {
        throw new ConflictException({
          erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Este email já está em uso' },
        });
      }
    }

    const atualizado = await this.prisma.comprador.update({
      where: { id: compradorId },
      data: {
        ...(dados.nome ? { nome: dados.nome } : {}),
        ...(dados.email ? { email: dados.email } : {}),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        criadoEm: true,
      },
    });

    return atualizado;
  }
}
