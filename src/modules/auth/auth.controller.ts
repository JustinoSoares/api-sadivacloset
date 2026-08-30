import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Register new user', description: 'Creates a new user account and returns user data' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict - email already exists' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.name, dto.email, dto.password);
    return { data: user };
  }

  // legacy alias
  @ApiExcludeEndpoint()
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/registar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user (PT alias)', description: 'Alias for register - cria nova conta' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async registarAlias(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.name, dto.email, dto.password);
    return { data: user, dados: user };
  }

  // ── POST /api/v1/auth/login ────────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login', description: 'Authenticates user and returns access and refresh tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ── POST /api/v1/auth/refresh ──────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh tokens', description: 'Refresh access token using refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid refresh token' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  // ── POST /api/v1/auth/logout ───────────────────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout', description: 'Invalidates refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refresh_token);
  }

  // ── POST /api/v1/auth/forgot-password ─────────────────────
  @Throttle({ esqueci: { limit: 5, ttl: 15 * 60 * 1000 } })
  @SkipThrottle({ auth: true, default: true, checkout: true })
  @Public()
  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot password', description: 'Sends password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiExcludeEndpoint()
  @Throttle({ esqueci: { limit: 5, ttl: 15 * 60 * 1000 } })
  @SkipThrottle({ auth: true, default: true, checkout: true })
  @Public()
  @Post('auth/esqueci-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot password (PT alias)', description: 'Alias for forgot-password' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async esqueciPasswordAlias(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ── POST /api/v1/auth/reset-password ───────────────────
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password', description: 'Resets password using token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid token' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @ApiExcludeEndpoint()
  @SkipThrottle({ esqueci: true, checkout: true })
  @Public()
  @Post('auth/redefinir-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password (PT alias)', description: 'Alias for reset-password' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async redefinirPasswordAlias(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ── GET /api/v1/profile ─────────────────────────────────────
  @Get('profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get profile', description: 'Returns authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.sub);
    return { data: profile, dados: profile };
  }

  // legacy alias
  @ApiExcludeEndpoint()
  @Get('perfil')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get profile (PT alias)', description: 'Alias for profile' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getPerfilAlias(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.sub);
    return { dados: profile, data: profile };
  }

  // ── PATCH /api/v1/profile ───────────────────────────────────
  @Patch('profile')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update profile', description: 'Updates authenticated user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const profile = await this.authService.updateProfile(user.sub, dto);
    return { data: profile, dados: profile };
  }

  @ApiExcludeEndpoint()
  @Patch('perfil')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update profile (PT alias)', description: 'Alias for update profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async patchPerfilAlias(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    const profile = await this.authService.updateProfile(user.sub, dto as any);
    return { dados: profile, data: profile };
  }
}
