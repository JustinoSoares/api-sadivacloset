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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async findAll(@Query() query: FilterProductsDto) {
    return this.productsService.findAll(query as any);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    const product = await this.productsService.create(dto as any, user.sub);
    return { data: product, dados: product };
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    const product = await this.productsService.update(id, dto as any, user.sub);
    return { data: product, dados: product };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id, user.sub);
  }
}

// Legacy Portuguese alias
@ApiTags('admin-produtos')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/produtos')
export class ProdutosAdminController extends ProductsAdminController {}
