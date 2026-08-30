import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminAccountService } from './admin-account.service';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('admin-account')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/account')
export class AdminAccountController {
  constructor(private readonly accountService: AdminAccountService) {}

  @Get()
  @ApiOperation({
    summary: 'Get authenticated admin account',
    description: 'Returns authenticated admin account',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getAccount(@CurrentUser() user: JwtPayload) {
    const account = await this.accountService.getAccount(user.sub);
    return { data: account, dados: account };
  }

  // legacy alias
  async getConta(user: JwtPayload) {
    return this.getAccount(user);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update admin account and change password (requires current password)',
    description: 'Updates admin account and changes password',
  })
  @ApiBody({ type: UpdateAccountDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async updateAccount(@CurrentUser() user: JwtPayload, @Body() dto: UpdateAccountDto) {
    const account = await this.accountService.updateAccount(user.sub, {
      name: (dto as any).nameNormalized ?? (dto as any).nomeNormalized,
      email: dto.emailNormalized,
      currentPassword:
        (dto as any).currentPasswordNormalized ?? (dto as any).passwordActualNormalized,
      newPassword: (dto as any).newPasswordNormalized ?? (dto as any).novaPasswordNormalized,
    });
    return { data: account, dados: account };
  }

  // legacy alias method delegate
  async updateConta(user: JwtPayload, dto: UpdateAccountDto) {
    return this.updateAccount(user, dto);
  }
}

@ApiExcludeController()
@ApiTags('admin-conta')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/conta')
export class AdminContaController extends AdminAccountController {}
