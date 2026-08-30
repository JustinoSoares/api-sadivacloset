import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProductsAdminController, ProdutosAdminController } from './products/products-admin.controller';
import { ProductsAdminService } from './products/products-admin.service';
import { AdminOrdersController, AdminPedidosController } from './orders/admin-orders.controller';
import { AdminOrdersService } from './orders/admin-orders.service';
import { AdminDeliveriesController, AdminEntregasController } from './deliveries/admin-deliveries.controller';
import { AdminDeliveriesService } from './deliveries/admin-deliveries.service';
import { AdminStatisticsController, AdminEstatisticasController } from './statistics/admin-statistics.controller';
import { AdminStatisticsService } from './statistics/admin-statistics.service';
import { AdminStoreController, AdminLojaController } from './store/admin-store.controller';
import { AdminStoreService } from './store/admin-store.service';
import { AdminAccountController, AdminContaController } from './account/admin-account.controller';
import { AdminAccountService } from './account/admin-account.service';
import { AdminPreferencesController, AdminPreferenciasController } from './preferences/admin-preferences.controller';
import { AdminPreferencesService } from './preferences/admin-preferences.service';
import { AdminMembersController, AdminMembrosController } from './members/admin-members.controller';
import { AdminMembersService } from './members/admin-members.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [NotificationsModule, AuditModule, AuditoriaModule],
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
    AdminStatisticsService,
    AdminStoreService,
    AdminAccountService,
    AdminPreferencesService,
    AdminMembersService,
  ],
  exports: [
    ProductsAdminService,
    AdminOrdersService,
    AdminDeliveriesService,
    AdminStatisticsService,
    AdminStoreService,
    AdminAccountService,
    AdminPreferencesService,
    AdminMembersService,
  ],
})
export class AdminModule {}
