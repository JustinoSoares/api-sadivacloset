import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@Throttle({ auth: { limit: 20, ttl: 60_000 }, default: { limit: 60, ttl: 60_000 } })
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /api/v1/auth/register ─────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.name, dto.email, dto.password);
    return { data: user };
  }

  // legacy alias
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/registar')
  @HttpCode(HttpStatus.CREATED)
  async registarAlias(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.name, dto.email, dto.password);
    return { data: user, dados: user };
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

  // ── POST /api/v1/auth/forgot-password ─────────────────────
  @Throttle({ esqueci: { limit: 5, ttl: 15 * 60 * 1000 } })
  @SkipThrottle({ auth: true, default: true, checkout: true })
  @Public()
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle({ esqueci: { limit: 5, ttl: 15 * 60 * 1000 } })
  @SkipThrottle({ auth: true, default: true, checkout: true })
  @Public()
  @Post('auth/esqueci-password')
  @HttpCode(HttpStatus.OK)
  async esqueciPasswordAlias(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ── POST /api/v1/auth/reset-password ───────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/redefinir-password')
  @HttpCode(HttpStatus.OK)
  async redefinirPasswordAlias(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ── GET /api/v1/profile ─────────────────────────────────────
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.sub);
    return { data: profile, dados: profile };
  }

  // legacy alias
  @Get('perfil')
  async getPerfilAlias(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.sub);
    return { dados: profile, data: profile };
  }

  // ── PATCH /api/v1/profile ───────────────────────────────────
  @Patch('profile')
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const profile = await this.authService.updateProfile(user.sub, dto);
    return { data: profile, dados: profile };
  }

  @Patch('perfil')
  async patchPerfilAlias(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const profile = await this.authService.updateProfile(user.sub, dto as any);
    return { dados: profile, data: profile };
  }
}
