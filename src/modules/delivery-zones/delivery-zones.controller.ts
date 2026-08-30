import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
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
}

@ApiExcludeController()
@ApiTags('zonas-entrega')
@Controller('zonas-entrega')
export class ZonasEntregaController extends DeliveryZonesController {}
