import { Module } from '@nestjs/common';
import { CategoriesController, CategoriasController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController, CategoriasController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
