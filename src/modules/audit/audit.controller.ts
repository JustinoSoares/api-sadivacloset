import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';

@ApiTags('admin-audit')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (paginated, filter by entity and date range)', description: 'Returns paginated audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async list(@Query() dto: FilterAuditDto) {
    return this.auditService.list(dto as any);
  }

  // Portuguese alias
  async listar(dto: FilterAuditDto) {
    return this.list(dto);
  }
}

@ApiExcludeController()
@ApiTags('admin-auditoria')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/auditoria')
export class AuditoriaController extends AuditController {}

// legacy file alias
export { FilterAuditDto as FilterAuditoriaDto };
