import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService, NotificacoesService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const notificationMock = {
    id: '22222222-2222-2222-2222-222222222222',
    buyerId,
    title: 'Pedido atualizado',
    description: 'Seu pedido foi enviado',
    createdAt: new Date('2026-08-26T10:00:00.000Z'),
    isRead: false,
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('criar / create', () => {
    it('should create notification with criar(compradorId,titulo,descricao)', async () => {
      prisma.notification.create.mockResolvedValue(notificationMock);
      const result = await service.criar(buyerId, 'Pedido atualizado', 'Seu pedido foi enviado');
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: { buyerId, title: 'Pedido atualizado', description: 'Seu pedido foi enviado' },
      });
      expect(result.title).toBe('Pedido atualizado');
      expect(result.description).toBe('Seu pedido foi enviado');
      expect(result.createdAt).toEqual(notificationMock.createdAt);
      expect(result.isRead).toBe(false);
      // ISO check
      expect(result.createdAt.toISOString()).toBe('2026-08-26T10:00:00.000Z');
    });

    it('create alias should delegate to criar', async () => {
      prisma.notification.create.mockResolvedValue(notificationMock);
      const result = await service.create(buyerId, 'Title', 'Desc');
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(result.title).toBe('Pedido atualizado');
    });

    it('should be reusable by Pedido/Pagamento modules', async () => {
      prisma.notification.create.mockResolvedValue({
        ...notificationMock,
        title: 'Pagamento confirmado',
      });
      const result = await service.criar(buyerId, 'Pagamento confirmado', 'Pagamento aprovado');
      expect(result.title).toBe('Pagamento confirmado');
    });
  });

  describe('findAll', () => {
    it('should list ordered by createdAt desc with English-only fields', async () => {
      prisma.notification.findMany.mockResolvedValue([
        notificationMock,
        {
          ...notificationMock,
          id: '3333',
          createdAt: new Date('2026-08-25T10:00:00.000Z'),
          isRead: true,
        },
      ]);

      const result = await service.findAll(buyerId);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { buyerId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(notificationMock.id);
      expect(result[0].isRead).toBe(false);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('marcarComoLida / markAsRead', () => {
    it('should mark one as read', async () => {
      prisma.notification.findUnique.mockResolvedValue(notificationMock);
      prisma.notification.update.mockResolvedValue({ ...notificationMock, isRead: true });
      const result = await service.marcarComoLida(buyerId, notificationMock.id);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: notificationMock.id },
        data: { isRead: true },
      });
      expect(result.isRead).toBe(true);
    });

    it('should throw 404 if not found or not owner', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.marcarComoLida(buyerId, 'non-existent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.notification.findUnique.mockResolvedValue({ ...notificationMock, buyerId: 'other' });
      await expect(service.marcarComoLida(buyerId, notificationMock.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('markAsRead alias should work', async () => {
      prisma.notification.findUnique.mockResolvedValue(notificationMock);
      prisma.notification.update.mockResolvedValue({ ...notificationMock, isRead: true });
      const result = await service.markAsRead(buyerId, notificationMock.id);
      expect(result.isRead).toBe(true);
    });
  });

  describe('marcarTodasComoLidas / markAllAsRead', () => {
    it('should mark all as read and return count', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });
      const result = await service.marcarTodasComoLidas(buyerId);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { buyerId, isRead: false },
        data: { isRead: true },
      });
      expect(result.count).toBe(5);
    });

    it('markAllAsRead alias should work', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 2 });
      const result = await service.markAllAsRead(buyerId);
      expect(result.count).toBe(2);
    });
  });

  it('legacy NotificacoesService alias should exist', () => {
    expect(NotificacoesService).toBeDefined();
    expect(NotificacoesService).toBe(NotificationsService);
  });
});
