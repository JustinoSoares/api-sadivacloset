import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProdutosAdminController } from './produtos/produtos-admin.controller';
import { ProdutosAdminService } from './produtos/produtos-admin.service';

@Module({
  controllers: [AdminController, ProdutosAdminController],
  providers: [ProdutosAdminService],
  exports: [ProdutosAdminService],
})
export class AdminModule {}
