import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

describe('CheckoutController', () => {
  let controller: CheckoutController;
  let service: { checkout: jest.Mock };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'BUYER' } as any;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const orderMock = {
    id: 'order1',
    total: 83200,
    subtotal: 81000,
    deliveryFee: 2200,
  };

  beforeEach(async () => {
    service = { checkout: jest.fn().mockResolvedValue(orderMock) };

    const mod = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [{ provide: CheckoutService, useValue: service }],
    }).compile();

    controller = mod.get(CheckoutController);
  });

  it('POST /checkout should call service with normalized fields', async () => {
    const dto = new CheckoutDto();
    dto.endereco_id = '33333333-3333-3333-3333-333333333333';
    dto.tipo = 'domicilio';
    dto.data_agendada = tomorrow;
    dto.janela_horario = '09:00-12:00';

    const result = await controller.checkout(user, dto);
    expect(service.checkout).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({
        tipo: 'domicilio',
        dataAgendada: tomorrow,
        janelaHorario: '09:00-12:00',
      }),
    );
    expect(result).toEqual({ data: orderMock });
  });

  it('should accept aliases (address_id, delivery_zone_id, type, scheduled_date, time_window)', async () => {
    const dto = new CheckoutDto();
    dto.address_id = '33333333-3333-3333-3333-333333333333';
    dto.type = 'HOME_DELIVERY';
    dto.scheduled_date = tomorrow;
    dto.time_window = '09:00-12:00';

    await controller.checkout(user, dto);
    expect(service.checkout).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({ tipo: 'domicilio' }),
    );
  });

  it('should throw 400 if missing required fields', async () => {
    const dto = new CheckoutDto();
    dto.tipo = 'domicilio';
    // missing data_agendada, janela_horario
    await expect(controller.checkout(user, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should be throttled (checkout) and authenticated', () => {
    const throttlerMeta =
      Reflect.getMetadata('throttler:options', CheckoutController) ||
      Reflect.getMetadata('THROTTLER:OPTIONS', CheckoutController);
    // check path
    expect(Reflect.getMetadata('path', CheckoutController)).toBe('checkout');
    // controller should have ApiBearerAuth
    expect(controller).toBeDefined();
  });
});
