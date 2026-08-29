import { Test } from '@nestjs/testing';
import { PedidosController, OrdersController } from './orders.controller';
import { PerfilPedidosController, ProfileOrdersController } from './perfil-pedidos.controller';
import { OrdersService } from './orders.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

describe('OrdersControllers', () => {
  let pedidosController: PedidosController;
  let ordersController: OrdersController;
  let perfilController: PerfilPedidosController;
  let service: any;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'BUYER' } as any;

  const orderMock = {
    id: orderId,
    comprador_id: buyerId,
    itens: [],
    entrega: null,
  };

  beforeEach(async () => {
    service = {
      findOne: jest.fn().mockResolvedValue(orderMock),
      cancel: jest.fn().mockResolvedValue({ ...orderMock, estado: 'cancelado' }),
      upsertDelivery: jest.fn().mockResolvedValue(orderMock),
      findAllPaginated: jest.fn().mockResolvedValue({ data: [orderMock], dados: [orderMock], page: 1, pagina: 1, total: 1, totalPages: 1, total_paginas: 1 }),
    };
    const mod = await Test.createTestingModule({
      controllers: [PedidosController, OrdersController, PerfilPedidosController, ProfileOrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();
    pedidosController = mod.get(PedidosController);
    ordersController = mod.get(OrdersController);
    perfilController = mod.get(PerfilPedidosController);
  });

  it('GET /pedidos/:id should return detail', async () => {
    const result = await pedidosController.findOne(user, orderId);
    expect(service.findOne).toHaveBeenCalledWith(buyerId, orderId);
    expect(result).toEqual({ data: orderMock, dados: orderMock });
  });

  it('PATCH /pedidos/:id/cancelar should cancel', async () => {
    const result = await pedidosController.cancelar(user, orderId);
    expect(service.cancel).toHaveBeenCalledWith(buyerId, orderId);
    expect(result.mensagem).toBe('Pedido cancelado');
  });

  it('POST /pedidos/:id/entrega should upsert', async () => {
    const dto = new UpdateDeliveryDto();
    dto.janela_horario = '09:00-12:00';
    dto.data_agendada = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await pedidosController.upsertEntrega(user, orderId, dto);
    expect(service.upsertDelivery).toHaveBeenCalled();
  });

  it('GET /perfil/pedidos should paginate', async () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 20;
    const result = await perfilController.findAll(user, dto);
    expect(service.findAllPaginated).toHaveBeenCalledWith(buyerId, dto);
    expect(result.total).toBe(1);
  });

  it('aliases /orders should mirror', async () => {
    await ordersController.findOne(user, orderId);
    expect(service.findOne).toHaveBeenCalled();
    await ordersController.cancel(user, orderId);
    expect(service.cancel).toHaveBeenCalled();
  });

  it('should have correct paths', () => {
    expect(Reflect.getMetadata('path', PedidosController)).toBe('pedidos');
    expect(Reflect.getMetadata('path', PerfilPedidosController)).toBe('perfil/pedidos');
  });
});
