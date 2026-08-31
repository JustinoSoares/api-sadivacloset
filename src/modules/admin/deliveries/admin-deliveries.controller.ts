import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'List deliveries (admin) paginated, filter by status and date',
    description: 'Returns paginated deliveries with filters',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@Query() dto: FilterDeliveriesDto) {
    return this.adminDeliveriesService.findAll(dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update delivery status (audit log and notify buyer)',
    description: 'Updates delivery status, creates audit log and notifies buyer',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateDeliveryStatusDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const result = await this.adminDeliveriesService.updateStatus(user.sub, id, dto);
    return { data: result };
  }

  @ApiExcludeEndpoint()
  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Update delivery status (legacy PT alias)',
    description: 'Alias for updating delivery status',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateDeliveryStatusDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async updateStatusLegacy(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const result = await this.adminDeliveriesService.updateStatus(user.sub, id, dto);
    return { data: result };
  }
}

@ApiExcludeController()
@ApiTags('admin-entregas')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/entregas')
export class AdminEntregasController extends AdminDeliveriesController {}
