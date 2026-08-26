import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { FilterProductsDto } from './dto/filter-products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public products (filterable, paginated, cache 60s)' })
  async findAll(@Query() query: FilterProductsDto) {
    return this.productsService.findAll(query as any);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Product details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productsService.findOne(id);
    return { data: product, dados: product };
  }
}

// Legacy Portuguese alias for backward compatibility
@ApiTags('produtos')
@Controller('produtos')
export class ProdutosPublicController extends ProductsController {}
