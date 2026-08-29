import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrdersService } from './orders.service';

@ApiTags('perfil-pedidos')
@ApiBearerAuth('bearer')
@Controller('perfil/pedidos')
export class PerfilPedidosController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Histórico de pedidos do comprador (paginado)' })
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
  @ApiOperation({ summary: 'Buyer order history (paginated)' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    const result = await this.ordersService.findAllPaginated(user.sub, dto);
    return result;
  }
}
