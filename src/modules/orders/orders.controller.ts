import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@ApiExcludeController()
@ApiTags('pedidos')
@ApiBearerAuth('bearer')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Order detail (items, delivery, payment)',
    description: 'Returns order detail with items, delivery and payment',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findOne(user.sub, id);
    return { data: order };
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order (only if delivery not on the way) and restore stock',
    description: 'Cancels order and restores stock',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async cancelar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.cancel(user.sub, id);
    return { data: order, message: 'Order cancelled' };
  }

  @Post(':id/entrega')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create/update delivery info',
    description: 'Create or update delivery scheduling and address',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateDeliveryDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async upsertEntrega(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    const order = await this.ordersService.upsertDelivery(user.sub, id, {
      enderecoId: dto.enderecoIdNormalized,
      dataAgendada: dto.dataAgendadaNormalized,
      janelaHorario: dto.janelaHorarioNormalized,
      instrucoes: dto.instrucoesNormalized,
    });
    return { data: order };
  }
}

@ApiTags('orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Order detail (items, delivery, payment)',
    description: 'Returns order detail with items, delivery and payment',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findOne(user.sub, id);
    return { data: order };
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order (only if delivery not on the way) and restore stock',
    description: 'Cancels order and restores stock',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.cancel(user.sub, id);
    return { data: order, message: 'Order cancelled' };
  }

  @Post(':id/delivery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create/update delivery info',
    description: 'Create or update delivery scheduling and address',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateDeliveryDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async upsertDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    const order = await this.ordersService.upsertDelivery(user.sub, id, {
      enderecoId: dto.enderecoIdNormalized,
      dataAgendada: dto.dataAgendadaNormalized,
      janelaHorario: dto.janelaHorarioNormalized,
      instrucoes: dto.instrucoesNormalized,
    });
    return { data: order };
  }
}
