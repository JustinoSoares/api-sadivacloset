import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PedidosController, OrdersController } from './orders.controller';
import { PerfilPedidosController, ProfileOrdersController } from './perfil-pedidos.controller';

@Module({
  controllers: [
    PedidosController,
    OrdersController,
    PerfilPedidosController,
    ProfileOrdersController,
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
