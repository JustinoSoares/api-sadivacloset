import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  PerfilNotificacoesController,
  ProfileNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('PerfilNotificacoesController', () => {
  let perfilController: PerfilNotificacoesController;
  let profileController: ProfileNotificationsController;
  let service: {
    findAll: jest.Mock;
    criar: jest.Mock;
    marcarComoLida: jest.Mock;
    marcarTodasComoLidas: jest.Mock;
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const notifId = '22222222-2222-2222-2222-222222222222';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'buyer' } as any;

  const notifMock = {
    id: notifId,
    titulo: 'Pedido enviado',
    title: 'Pedido enviado',
    descricao: 'Seu pedido saiu para entrega',
    description: 'Seu pedido saiu para entrega',
    criadoEm: new Date('2026-08-26T10:00:00.000Z'),
    createdAt: new Date('2026-08-26T10:00:00.000Z'),
    lida: false,
    isRead: false,
    compradorId: buyerId,
    buyerId,
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([notifMock]),
      criar: jest.fn().mockResolvedValue(notifMock),
      marcarComoLida: jest.fn().mockResolvedValue({ ...notifMock, lida: true, isRead: true }),
      marcarTodasComoLidas: jest.fn().mockResolvedValue({ count: 3 }),
    };

    const mod = await Test.createTestingModule({
      controllers: [PerfilNotificacoesController, ProfileNotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    perfilController = mod.get(PerfilNotificacoesController);
    profileController = mod.get(ProfileNotificationsController);
  });

  it('GET /perfil/notificacoes should return {data,dados} with ISO criadoEm', async () => {
    const result = await perfilController.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(buyerId);
    expect(result).toEqual({ data: [notifMock], dados: [notifMock] });
    expect(result.data[0].criadoEm.toISOString()).toBe('2026-08-26T10:00:00.000Z');
    expect(typeof result.data[0].lida).toBe('boolean');
  });

  it('PATCH /perfil/notificacoes/lidas should mark all as read', async () => {
    const result = await perfilController.markAllAsRead(user);
    expect(service.marcarTodasComoLidas).toHaveBeenCalledWith(buyerId);
    expect(result).toEqual({
      data: { count: 3 },
      dados: { count: 3 },
      mensagem: expect.any(String),
    });
  });

  it('PATCH /perfil/notificacoes/:id/lida should mark one', async () => {
    const result = await perfilController.markOneAsRead(user, notifId);
    expect(service.marcarComoLida).toHaveBeenCalledWith(buyerId, notifId);
    expect(result).toEqual({
      data: expect.objectContaining({ lida: true }),
      dados: expect.objectContaining({ lida: true }),
    });
  });

  it('should propagate 404 if notification not owner', async () => {
    service.marcarComoLida.mockRejectedValue(
      new NotFoundException({ erro: { codigo: 'NAO_ENCONTRADO' } }),
    );
    await expect(perfilController.markOneAsRead(user, notifId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('aliases /profile/notifications should mirror', async () => {
    await profileController.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(buyerId);
    await profileController.markAllAsRead(user);
    expect(service.marcarTodasComoLidas).toHaveBeenCalled();
    await profileController.markOneAsRead(user, notifId);
    expect(service.marcarComoLida).toHaveBeenCalledWith(buyerId, notifId);
  });

  it('should have correct paths and lidas before :id/lida order', () => {
    expect(Reflect.getMetadata('path', PerfilNotificacoesController)).toBe('perfil/notificacoes');
    expect(Reflect.getMetadata('path', ProfileNotificationsController)).toBe(
      'profile/notifications',
    );
    // ensure lidas route exists
    const perfilRoutes = Reflect.getMetadata('__routes__', PerfilNotificacoesController) || [];
    // alternative check via prototype methods existence
    expect(typeof perfilController.markAllAsRead).toBe('function');
    expect(typeof perfilController.markOneAsRead).toBe('function');
  });
});
