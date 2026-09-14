import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { DeliveryZonesService } from './delivery-zones.service';

@ApiTags('delivery-zones')
@Controller('delivery-zones')
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List delivery zones (public, cache 60s)',
    description: 'Returns delivery zones with 60s cache',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll() {
    return this.deliveryZonesService.findAll();
  }

  @Public()
  @Get('quote')
  @ApiOperation({
    summary: 'Quote delivery fee (unified price)',
    description:
      'Calcula taxa de entrega unificada. Prioriza: zoneId > neighborhood > addressId > defaultDeliveryFee. Requer autenticação se usar addressId sem parâmetros explícitos (usa endereço padrão do buyer). Valor retornado é o mesmo usado em POST /checkout e incluído no Payment.amount (order.total = subtotal + deliveryFee).',
  })
  @ApiQuery({ name: 'zoneId', required: false, type: 'string', description: 'Delivery zone UUID' })
  @ApiQuery({ name: 'neighborhood', required: false, type: 'string', description: 'Bairro ex: Talatona' })
  @ApiQuery({ name: 'addressId', required: false, type: 'string', description: 'Address UUID do buyer' })
  @ApiResponse({ status: 200, description: 'Quote with deliveryFee and deliveryZone' })
  @ApiResponse({ status: 404, description: 'Zone not found when zoneId invalid' })
  async quote(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('zoneId') zoneId?: string,
    @Query('neighborhood') neighborhood?: string,
    @Query('bairro') bairro?: string,
    @Query('addressId') addressId?: string,
    @Query('enderecoId') enderecoId?: string,
  ) {
    const qZoneId = zoneId?.trim() || undefined;
    const qNeighborhood = (neighborhood ?? bairro)?.trim() || undefined;
    const qAddressId = (addressId ?? enderecoId)?.trim() || undefined;
    const result = await this.deliveryZonesService.quote({
      zoneId: qZoneId,
      neighborhood: qNeighborhood,
      addressId: qAddressId,
      buyerId: user?.sub,
    });
    return { data: result };
  }

  @Public()
  @Get('by-neighborhood/:neighborhood')
  @ApiOperation({
    summary: 'Get delivery zone by neighborhood (public)',
    description: 'Returns zone price by bairro name (ex: Talatona)',
  })
  @ApiParam({ name: 'neighborhood', type: 'string', example: 'Talatona' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findByNeighborhood(@Param('neighborhood') neighborhood: string) {
    const zone = await this.deliveryZonesService.findByNeighborhood(neighborhood);
    return { data: zone };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get delivery zone by id (public)', description: 'Returns single zone with price' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const zone = await this.deliveryZonesService.findOne(id);
    return { data: zone };
  }
}

@ApiExcludeController()
@ApiTags('zonas-entrega')
@Controller('zonas-entrega')
export class ZonasEntregaController extends DeliveryZonesController {}
