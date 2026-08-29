import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProductsAdminController, ProdutosAdminController } from './produtos/products-admin.controller';
import { ProductsAdminService } from './produtos/products-admin.service';
import { AdminPedidosController, AdminOrdersController } from './pedidos/admin-orders.controller';
import { AdminOrdersService } from './pedidos/admin-orders.service';
import { AdminEntregasController, AdminDeliveriesController } from './entregas/admin-deliveries.controller';
import { AdminDeliveriesService } from './entregas/admin-deliveries.service';
import { AdminEstatisticasController, AdminStatisticsController } from './estatisticas/admin-estatisticas.controller';
import { AdminEstatisticasService } from './estatisticas/admin-estatisticas.service';
import { AdminLojaController, AdminStoreController } from './loja/admin-loja.controller';
import { AdminLojaService } from './loja/admin-loja.service';
import { AdminContaController, AdminAccountController } from './conta/admin-conta.controller';
import { AdminContaService } from './conta/admin-conta.service';
import { AdminPreferenciasController, AdminPreferencesController } from './preferencias/admin-preferencias.controller';
import { AdminPreferenciasService } from './preferencias/admin-preferencias.service';
import { AdminMembrosController, AdminMembersController } from './membros/admin-membros.controller';
import { AdminMembrosService } from './membros/admin-membros.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [NotificationsModule, AuditoriaModule],
  controllers: [
    AdminController,
    ProductsAdminController,
    ProdutosAdminController,
    AdminPedidosController,
    AdminOrdersController,
    AdminEntregasController,
    AdminDeliveriesController,
    AdminEstatisticasController,
    AdminStatisticsController,
    AdminLojaController,
    AdminStoreController,
    AdminContaController,
    AdminAccountController,
    AdminPreferenciasController,
    AdminPreferencesController,
    AdminMembrosController,
    AdminMembersController,
  ],
  providers: [
    ProductsAdminService,
    AdminOrdersService,
    AdminDeliveriesService,
    AdminEstatisticasService,
    AdminLojaService,
    AdminContaService,
    AdminPreferenciasService,
    AdminMembrosService,
  ],
  exports: [
    ProductsAdminService,
    AdminOrdersService,
    AdminDeliveriesService,
    AdminEstatisticasService,
    AdminLojaService,
    AdminContaService,
    AdminPreferenciasService,
    AdminMembrosService,
  ],
})
export class AdminModule {}
