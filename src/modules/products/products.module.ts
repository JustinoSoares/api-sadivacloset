import { Module } from '@nestjs/common';
import { ProdutosPublicController } from './produtos-public.controller';
import { ProdutosPublicService } from './produtos-public.service';

@Module({
  controllers: [ProdutosPublicController],
  providers: [ProdutosPublicService],
  exports: [ProdutosPublicService],
})
export class ProductsModule {}
