import { Module } from '@nestjs/common';
import { DeliveryZonesController, ZonasEntregaController } from './delivery-zones.controller';
import { DeliveryZonesService } from './delivery-zones.service';

@Module({
  controllers: [DeliveryZonesController, ZonasEntregaController],
  providers: [DeliveryZonesService],
  exports: [DeliveryZonesService],
})
export class DeliveryZonesModule {}

export const ZonasEntregaModule = DeliveryZonesModule;
