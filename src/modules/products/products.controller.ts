import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { FilterProductsDto } from './dto/filter-products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List public products (filterable, paginated, cache 60s)',
    description: 'Returns paginated public products with filters, sorting and 60s cache',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@Query() query: FilterProductsDto) {
    return this.productsService.findAll(query as any);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Product details', description: 'Returns product details by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const product = await this.productsService.findOne(id);
    return { data: product, dados: product };
  }
}

// Legacy Portuguese alias for backward compatibility
@ApiExcludeController()
@ApiTags('produtos')
@Controller('produtos')
export class ProdutosPublicController extends ProductsController {}
