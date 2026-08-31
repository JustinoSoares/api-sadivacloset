import { Test } from '@nestjs/testing';
import { DeliveryZonesController, ZonasEntregaController } from './delivery-zones.controller';
import { DeliveryZonesService } from './delivery-zones.service';

describe('DeliveryZonesController', () => {
  let controller: DeliveryZonesController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = { findAll: jest.fn().mockResolvedValue({ data: [] }) };
    const mod = await Test.createTestingModule({
      controllers: [DeliveryZonesController, ZonasEntregaController],
      providers: [{ provide: DeliveryZonesService, useValue: service }],
    }).compile();
    controller = mod.get(DeliveryZonesController);
  });

  it('should delegate to service', async () => {
    const mock = {
      data: [{ id: '1', neighborhood: 'Talatona', price: 2500 }],
    };
    service.findAll.mockResolvedValue(mock);
    const result = await controller.findAll();
    expect(result).toEqual(mock);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should be public (metadata)', () => {
    const isPublic = Reflect.getMetadata('isPublic', DeliveryZonesController.prototype.findAll);
    expect(isPublic).toBe(true);
  });

  it('ZonasEntregaController should extend DeliveryZonesController', () => {
    expect(ZonasEntregaController.prototype instanceof DeliveryZonesController).toBe(true);
    // Check controller paths
    const enPath = Reflect.getMetadata('path', DeliveryZonesController);
    const ptPath = Reflect.getMetadata('path', ZonasEntregaController);
    expect(enPath).toBe('delivery-zones');
    expect(ptPath).toBe('zonas-entrega');
  });
});
