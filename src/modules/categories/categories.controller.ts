import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List categories with product counts' })
  async findAll() {
    return this.categoriesService.findAll();
  }
}

@ApiTags('categorias')
@Controller('categorias')
export class CategoriasController extends CategoriesController {}
