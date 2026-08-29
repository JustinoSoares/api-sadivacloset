import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminEstatisticasService } from './admin-estatisticas.service';
import { QueryEstatisticasDto } from './dto/query-estatisticas.dto';

@ApiTags('admin-estatisticas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/estatisticas')
export class AdminEstatisticasController {
  constructor(private readonly estatisticasService: AdminEstatisticasService) {}

  @Get()
  @ApiOperation({
    summary: 'Dashboard admin – receita total (pago/concluido), nº produtos, nº membros, nº pedidos + variação vs período anterior',
    description:
      'Calcula janela atual (últimos N dias, default 30) vs janela anterior equivalente. Aceita ?dias, ?data_inicio&data_fim (ou from/to). Retorna totais, valores do período, variação percentual e listagem paginada de pedidos recentes (page/limit).',
  })
  async getEstatisticas(@Query() dto: QueryEstatisticasDto) {
    const result = await this.estatisticasService.getEstatisticas(dto);
    return { data: result, dados: result };
  }
}

@ApiTags('admin-statistics')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/statistics')
export class AdminStatisticsController extends AdminEstatisticasController {}
