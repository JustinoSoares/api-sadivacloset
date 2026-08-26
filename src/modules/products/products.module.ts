import { Module } from '@nestjs/common';
import { ProductsController, ProdutosPublicController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, ProdutosPublicController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
