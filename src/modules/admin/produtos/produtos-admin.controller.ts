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
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { FiltrarProdutosDto } from './dto/filtrar-produtos.dto';
import { ProdutosAdminService } from './produtos-admin.service';

@ApiTags('admin-produtos')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/produtos')
export class ProdutosAdminController {
  constructor(private readonly produtosService: ProdutosAdminService) {}

  @Get()
  async findAll(@Query() query: FiltrarProdutosDto) {
    return this.produtosService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProdutoDto) {
    const produto = await this.produtosService.create(dto);
    return { dados: produto };
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProdutoDto) {
    const produto = await this.produtosService.update(id, dto);
    return { dados: produto };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.produtosService.remove(id);
  }
}
