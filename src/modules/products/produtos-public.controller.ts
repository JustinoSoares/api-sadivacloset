import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { FiltrarProdutosPublicDto } from './dto/filtrar-produtos-public.dto';
import { ProdutosPublicService } from './produtos-public.service';

@ApiTags('produtos')
@Controller('produtos')
export class ProdutosPublicController {
  constructor(private readonly produtosService: ProdutosPublicService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista produtos público (filtrável, paginado, cache 60s)' })
  async findAll(@Query() query: FiltrarProdutosPublicDto) {
    return this.produtosService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Ficha do produto' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const produto = await this.produtosService.findOne(id);
    return { dados: produto };
  }
}
