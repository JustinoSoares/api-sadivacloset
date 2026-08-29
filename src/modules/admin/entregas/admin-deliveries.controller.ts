import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminDeliveriesService } from './admin-deliveries.service';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

@ApiTags('admin-entregas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/entregas')
export class AdminEntregasController {
  constructor(private readonly adminDeliveriesService: AdminDeliveriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista entregas (admin) paginado, filtro por estado e data' })
  async findAll(@Query() dto: FilterDeliveriesDto) {
    return this.adminDeliveriesService.findAll(dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Atualiza estado da entrega (regista auditoria e notifica comprador)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const result = await this.adminDeliveriesService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }
}

@ApiTags('admin-deliveries')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/deliveries')
export class AdminDeliveriesController extends AdminEntregasController {}
