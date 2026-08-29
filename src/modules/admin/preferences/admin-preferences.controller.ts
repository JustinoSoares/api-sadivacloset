import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminPreferencesService } from './admin-preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('admin-preferences')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/preferences')
export class AdminPreferencesController {
  constructor(private readonly preferencesService: AdminPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get admin preferences (AdminPreferences)' })
  async getPreferences() {
    const pref = await this.preferencesService.getPreferences();
    return { data: pref, dados: pref };
  }

  // legacy alias
  async getPreferencias() {
    return this.getPreferences();
  }

  @Patch()
  @ApiOperation({ summary: 'Update preferences (notifications, defaultDeliveryFee, activePaymentMethods)' })
  async updatePreferences(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferencesDto) {
    const pref = await this.preferencesService.updatePreferences(
      {
        notifyNewOrders: dto.notifyNewOrdersNormalized,
        notifyLowStock: dto.notifyLowStockNormalized,
        notifyNewMessages: dto.notifyNewMessagesNormalized,
        defaultDeliveryFee: dto.defaultDeliveryFeeNormalized,
        activePaymentMethods: dto.activePaymentMethodsNormalized,
      },
      user.sub,
    );
    return { data: pref, dados: pref };
  }

  // legacy alias method
  async updatePreferencias(user: JwtPayload, dto: UpdatePreferencesDto) {
    return this.updatePreferences(user, dto);
  }
}

@ApiTags('admin-preferencias')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/preferencias')
export class AdminPreferenciasController extends AdminPreferencesController {}
