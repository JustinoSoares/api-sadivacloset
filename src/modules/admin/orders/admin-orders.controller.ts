import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiResponse, ApiBody, ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminOrdersService } from './admin-orders.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('admin-orders')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders (admin) paginated, filters by status and date range', description: 'Returns paginated orders with filters' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@Query() dto: FilterOrdersDto) {
    return this.adminOrdersService.findAll(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (audit log and notify buyer)', description: 'Updates order status, creates audit log and notifies buyer' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const result = await this.adminOrdersService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }

  @ApiExcludeEndpoint()
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Update order status (legacy PT alias)', description: 'Alias for updating order status' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async updateStatusLegacy(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const result = await this.adminOrdersService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }
}

@ApiExcludeController()
@ApiTags('admin-pedidos')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/pedidos')
export class AdminPedidosController extends AdminOrdersController {}
