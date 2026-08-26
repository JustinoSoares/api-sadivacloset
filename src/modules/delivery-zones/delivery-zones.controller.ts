import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { DeliveryZonesService } from './delivery-zones.service';

@ApiTags('delivery-zones')
@Controller('delivery-zones')
export class DeliveryZonesController {
  constructor(private readonly deliveryZonesService: DeliveryZonesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List delivery zones (public, cache 60s)' })
  async findAll() {
    return this.deliveryZonesService.findAll();
  }
}

@ApiTags('zonas-entrega')
@Controller('zonas-entrega')
export class ZonasEntregaController extends DeliveryZonesController {}
