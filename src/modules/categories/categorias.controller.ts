import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriasService } from './categorias.service';

@ApiTags('categorias')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista categorias com contagem de produtos' })
  async findAll() {
    return this.categoriasService.findAll();
  }
}
