import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminMembrosService } from './admin-membros.service';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@ApiExcludeController()
@ApiTags('admin-membros')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/membros')
export class AdminMembrosController {
  constructor(private readonly membrosService: AdminMembrosService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de compradores (membros), pesquisa por nome/email, com contagem de pedidos e total gasto via join por comprador_id',
    description: 'Filtra por ?q / ?search / ?pesquisa (LIKE insensível em nome e email). Agrega via Order.groupBy buyerId – soma total gasto (pago/concluido) e contagem total de pedidos.',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll(@Query() dto: FilterMembrosDto) {
    return this.membrosService.findAll(dto);
  }

  @Get(':id/pedidos')
  @ApiOperation({ summary: 'Histórico de pedidos de um membro (comprador)', description: 'Returns order history for member' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findPedidos(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDto) {
    return this.membrosService.findPedidosByMembro(id, dto);
  }
}

@ApiTags('admin-members')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/members')
export class AdminMembersController extends AdminMembrosController {}
