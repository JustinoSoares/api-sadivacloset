import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminEstatisticasService } from './admin-estatisticas.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';

@ApiExcludeController()
@ApiTags('admin-estatisticas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/estatisticas')
export class AdminEstatisticasController {
  constructor(private readonly estatisticasService: AdminEstatisticasService) {}

  @Get()
  @ApiOperation({
    summary:
      'Dashboard admin – receita total (pago/concluido), nº produtos, nº membros, nº pedidos + variação vs período anterior',
    description:
      'Calcula janela atual (últimos N dias, default 30) vs janela anterior equivalente. Aceita ?dias, ?data_inicio&data_fim (ou from/to). Retorna totais, valores do período, variação percentual e listagem paginada de pedidos recentes (page/limit).',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEstatisticas(@Query() dto: QueryEstatisticasDto) {
    const result = await this.estatisticasService.getEstatisticas(dto);
    return { data: result };
  }
}

@ApiTags('admin-statistics')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/statistics')
export class AdminStatisticsController extends AdminEstatisticasController {}
