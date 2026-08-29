import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminOrdersService } from './admin-orders.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('admin-pedidos')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/pedidos')
export class AdminPedidosController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista pedidos (admin) paginado, filtros por estado e intervalo de data' })
  async findAll(@Query() dto: FilterOrdersDto) {
    return this.adminOrdersService.findAll(dto);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Atualiza estado do pedido (regista auditoria e notifica comprador)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const result = await this.adminOrdersService.updateStatus(user.sub, id, dto);
    return { data: result, dados: result };
  }
}

@ApiTags('admin-orders')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController extends AdminPedidosController {}
