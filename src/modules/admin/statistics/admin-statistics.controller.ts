import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminStatisticsService } from './admin-statistics.service';
import { QueryStatisticsDto } from './dto/query-statistics.dto';

@ApiTags('admin-statistics')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/statistics')
export class AdminStatisticsController {
  constructor(private readonly statisticsService: AdminStatisticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Admin dashboard – total revenue (paid/completed), product count, member count, order count + variation vs previous period',
    description:
      'Calculates current window (last N days, default 30) vs equivalent previous window. Accepts ?days, ?from/to (or data_inicio/data_fim). Returns totals, period values, percentage variation and paginated list of recent orders (page/limit).',
  })
  async getStatistics(@Query() dto: QueryStatisticsDto) {
    const result = await this.statisticsService.getStatistics(dto);
    return { data: result, dados: result };
  }

  // legacy alias
  async getEstatisticas(dto: QueryStatisticsDto) {
    return this.getStatistics(dto);
  }
}

@ApiTags('admin-estatisticas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/estatisticas')
export class AdminEstatisticasController extends AdminStatisticsController {}
