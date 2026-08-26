import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProductsAdminController, ProdutosAdminController } from './produtos/products-admin.controller';
import { ProductsAdminService } from './produtos/products-admin.service';

@Module({
  controllers: [AdminController, ProductsAdminController, ProdutosAdminController],
  providers: [ProductsAdminService],
  exports: [ProductsAdminService],
})
export class AdminModule {}
