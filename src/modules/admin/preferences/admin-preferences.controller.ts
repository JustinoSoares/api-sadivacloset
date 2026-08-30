import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiBody, ApiExcludeController } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get admin preferences (AdminPreferences)', description: 'Returns admin preferences' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getPreferences() {
    const pref = await this.preferencesService.getPreferences();
    return { data: pref, dados: pref };
  }

  // legacy alias
  async getPreferencias() {
    return this.getPreferences();
  }

  @Patch()
  @ApiOperation({ summary: 'Update preferences (notifications, defaultDeliveryFee, activePaymentMethods)', description: 'Updates admin preferences' })
  @ApiBody({ type: UpdatePreferencesDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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

@ApiExcludeController()
@ApiTags('admin-preferencias')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/preferencias')
export class AdminPreferenciasController extends AdminPreferencesController {}
