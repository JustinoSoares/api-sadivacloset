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
import { AdminPreferenciasService } from './admin-preferencias.service';
import { UpdatePreferenciasDto } from './dto/update-preferencias.dto';

@ApiExcludeController()
@ApiTags('admin-preferencias')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/preferencias')
export class AdminPreferenciasController {
  constructor(private readonly preferenciasService: AdminPreferenciasService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtém preferências do admin (PreferenciasAdmin)',
    description: 'Returns admin preferences',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getPreferencias() {
    const pref = await this.preferenciasService.getPreferencias();
    return { data: pref, dados: pref };
  }

  @Patch()
  @ApiOperation({
    summary: 'Atualiza preferências (notificações, taxaEntregaPadrao, metodosPagamentoAtivos)',
    description: 'Updates preferences',
  })
  @ApiBody({ type: UpdatePreferenciasDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updatePreferencias(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePreferenciasDto) {
    const pref = await this.preferenciasService.updatePreferencias(
      {
        notificarNovosPedidos: dto.notifyNewOrdersNormalized,
        notificarStockBaixo: dto.notifyLowStockNormalized,
        notificarNovasMensagens: dto.notifyNewMessagesNormalized,
        taxaEntregaPadrao: dto.defaultDeliveryFeeNormalized,
        metodosPagamentoAtivos: dto.activePaymentMethodsNormalized,
      },
      user.sub,
    );
    return { data: pref, dados: pref };
  }
}

@ApiTags('admin-preferences')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/preferences')
export class AdminPreferencesController extends AdminPreferenciasController {}
