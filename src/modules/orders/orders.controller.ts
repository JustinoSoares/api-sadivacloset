import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@ApiTags('pedidos')
@ApiBearerAuth('bearer')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe completo do pedido (itens, entrega, pagamento)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const pedido = await this.ordersService.findOne(user.sub, id);
    return { data: pedido, dados: pedido };
  }

  @Patch(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela pedido (só se entrega ainda não estiver a caminho/em entrega) e repõe stock' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancelar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const pedido = await this.ordersService.cancel(user.sub, id);
    return { data: pedido, dados: pedido, mensagem: 'Pedido cancelado' };
  }

  @Post(':id/entrega')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regista/edita data_agendada, janela_horario e morada da entrega' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async upsertEntrega(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ) {
    const pedido = await this.ordersService.upsertDelivery(user.sub, id, {
      enderecoId: dto.enderecoIdNormalized,
      dataAgendada: dto.dataAgendadaNormalized,
      janelaHorario: dto.janelaHorarioNormalized,
      instrucoes: dto.instrucoesNormalized,
    });
    return { data: pedido, dados: pedido };
  }
}

@ApiTags('orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Order detail (items, delivery, payment)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findOne(user.sub, id);
    return { data: order, dados: order };
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order (only if delivery not on the way) and restore stock' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.cancel(user.sub, id);
    return { data: order, dados: order, message: 'Order cancelled', mensagem: 'Pedido cancelado' };
  }

  @Post(':id/delivery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create/update delivery info' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
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
    return { data: order, dados: order };
  }
}
