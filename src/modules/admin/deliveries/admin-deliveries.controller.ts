import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminDeliveriesService } from './admin-deliveries.service';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

@ApiTags('admin-deliveries')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/deliveries')
export class AdminDeliveriesController {
  constructor(private readonly adminDeliveriesService: AdminDeliveriesService) {}

  @Get()
  @ApiOperation({ summary: 'List deliveries (admin) paginated, filter by status and date' })
  async findAll(@Query() dto: FilterDeliveriesDto) {
    return this.adminDeliveriesService.findAll(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update delivery status (audit log and notify buyer)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const result = await this.adminDeliveriesService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Atualiza estado da entrega (alias legada)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatusLegacy(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const result = await this.adminDeliveriesService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }
}

@ApiTags('admin-entregas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/entregas')
export class AdminEntregasController extends AdminDeliveriesController {}
