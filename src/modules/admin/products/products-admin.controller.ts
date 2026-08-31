import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { ProductsAdminService } from './products-admin.service';

@ApiTags('admin-products')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/products')
export class ProductsAdminController {
  constructor(private readonly productsService: ProductsAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'List products (admin, paginated, filterable)',
    description: 'Returns paginated products for admin with filters',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@Query() query: FilterProductsDto) {
    return this.productsService.findAll(query as any);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create product', description: 'Creates a new product' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto as any, user.sub);
    return { data: product };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product', description: 'Updates product by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.update(id, dto as any, user.sub);
    return { data: product };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product', description: 'Deletes product by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id, user.sub);
  }
}

// Legacy Portuguese alias
@ApiExcludeController()
@ApiTags('admin-produtos')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/produtos')
export class ProdutosAdminController extends ProductsAdminController {}
