import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RegistarDto } from './dto/registar.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { EsqueciPasswordDto } from './dto/esqueci-password.dto';
import { RedefinirPasswordDto } from './dto/redefinir-password.dto';
import { AtualizarPerfilDto } from './dto/perfil.dto';

@ApiTags('auth')
@Throttle({ auth: { limit: 20, ttl: 60_000 }, default: { limit: 60, ttl: 60_000 } })
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /api/v1/auth/registar ─────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/registar')
  @HttpCode(HttpStatus.CREATED)
  async registar(@Body() dto: RegistarDto) {
    const comprador = await this.authService.registar(dto.nome, dto.email, dto.password);
    return { dados: comprador };
  }

  // ── POST /api/v1/auth/login ────────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ── POST /api/v1/auth/refresh ──────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  // ── POST /api/v1/auth/logout ───────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refresh_token);
  }

  // ── POST /api/v1/auth/esqueci-password ─────────────────────
  @Throttle({ esqueci: { limit: 5, ttl: 15 * 60 * 1000 } })
  @SkipThrottle({ auth: true, default: true, checkout: true })
  @Public()
  @Post('auth/esqueci-password')
  @HttpCode(HttpStatus.OK)
  async esqueciPassword(@Body() dto: EsqueciPasswordDto) {
    return this.authService.esqueciPassword(dto.email);
  }

  // ── POST /api/v1/auth/redefinir-password ───────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/redefinir-password')
  @HttpCode(HttpStatus.OK)
  async redefinirPassword(@Body() dto: RedefinirPasswordDto) {
    return this.authService.redefinirPassword(dto.token, dto.novaPassword);
  }

  // ── GET /api/v1/perfil ─────────────────────────────────────
  @Get('perfil')
  async getPerfil(@CurrentUser() user: JwtPayload) {
    const perfil = await this.authService.getPerfil(user.sub);
    return { dados: perfil };
  }

  // ── PATCH /api/v1/perfil ───────────────────────────────────
  @Patch('perfil')
  async patchPerfil(@CurrentUser() user: JwtPayload, @Body() dto: AtualizarPerfilDto) {
    const perfil = await this.authService.atualizarPerfil(user.sub, dto);
    return { dados: perfil };
  }
}
