import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiResponse, ApiExcludeController, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminMembersService } from './admin-members.service';
import { FilterMembersDto } from './dto/filter-members.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@ApiTags('admin-members')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/members')
export class AdminMembersController {
  constructor(private readonly membersService: AdminMembersService) {}

  @Get()
  @ApiOperation({
    summary: 'Paginated list of buyers (members), search by name/email, with order count and total spent via join by buyerId',
    description: 'Filters by ?q / ?search / ?pesquisa (LIKE insensitive on name and email). Aggregates via Order.groupBy buyerId – sum total spent (paid/completed) and total order count.',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@Query() dto: FilterMembersDto) {
    return this.membersService.findAll(dto);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Order history of a member (buyer)', description: 'Returns order history for member' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findOrdersByMember(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDto) {
    return this.membersService.findOrdersByMember(id, dto);
  }

  @ApiExcludeEndpoint()
  @Get(':id/pedidos')
  @ApiOperation({ summary: 'Order history of a member (buyer) [legacy alias]', description: 'Alias for member order history' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findPedidosByMembro(@Param('id', ParseUUIDPipe) id: string, @Query() dto: PaginationDto) {
    return this.membersService.findOrdersByMember(id, dto);
  }
}

@ApiExcludeController()
@ApiTags('admin-membros')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/membros')
export class AdminMembrosController extends AdminMembersController {}
