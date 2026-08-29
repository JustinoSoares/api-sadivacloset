import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminAccountService } from './admin-account.service';
import { UpdateContaDto } from './dto/update-account.dto';

@ApiTags('admin-account')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/account')
export class AdminAccountController {
  constructor(private readonly accountService: AdminAccountService) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated admin account' })
  async getAccount(@CurrentUser() user: JwtPayload) {
    const account = await this.accountService.getAccount(user.sub);
    return { data: account, dados: account };
  }

  // legacy alias
  async getConta(user: JwtPayload) {
    return this.getAccount(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Update admin account and change password (requires current password)' })
  async updateAccount(@CurrentUser() user: JwtPayload, @Body() dto: UpdateContaDto) {
    const account = await this.accountService.updateAccount(user.sub, {
      name: dto.nomeNormalized,
      email: dto.emailNormalized,
      currentPassword: dto.passwordActualNormalized,
      newPassword: dto.novaPasswordNormalized,
    });
    return { data: account, dados: account };
  }

  // legacy alias method delegate
  async updateConta(user: JwtPayload, dto: UpdateContaDto) {
    return this.updateAccount(user, dto);
  }
}

@ApiTags('admin-conta')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/conta')
export class AdminContaController extends AdminAccountController {}
