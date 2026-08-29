import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminMembrosService } from './admin-membros.service';
import { FilterMembrosDto } from './dto/filter-membros.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

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
  async findAll(@Query() dto: FilterMembrosDto) {
    return this.membrosService.findAll(dto);
  }

  @Get(':id/pedidos')
  @ApiOperation({ summary: 'Histórico de pedidos de um membro (comprador)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findPedidos(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDto) {
    return this.membrosService.findPedidosByMembro(id, dto);
  }
}

@ApiTags('admin-members')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/members')
export class AdminMembersController extends AdminMembrosController {}
