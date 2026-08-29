import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { FilterAuditoriaDto } from './dto/filter-auditoria.dto';

@ApiTags('admin-auditoria')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista auditoria (paginado, filtro por entidade e intervalo de data)' })
  async listar(@Query() dto: FilterAuditoriaDto) {
    return this.auditoriaService.listar(dto as any);
  }
}

@ApiTags('admin-audit')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/audit')
export class AuditController extends AuditoriaController {}
