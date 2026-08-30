import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrdersService } from './orders.service';

@ApiExcludeController()
@ApiTags('perfil-pedidos')
@ApiBearerAuth('bearer')
@Controller('perfil/pedidos')
export class PerfilPedidosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Histórico de pedidos do comprador (paginado)',
    description: 'Returns paginated order history for buyer',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    const result = await this.ordersService.findAllPaginated(user.sub, dto);
    return result;
  }
}

@ApiTags('profile-orders')
@ApiBearerAuth('bearer')
@Controller('profile/orders')
export class ProfileOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Buyer order history (paginated)',
    description: 'Returns paginated order history for buyer',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    const result = await this.ordersService.findAllPaginated(user.sub, dto);
    return result;
  }
}
