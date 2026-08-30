import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationResponse {
  id: string;
  titulo: string;
  title: string;
  descricao: string;
  description: string;
  criadoEm: Date;
  createdAt: Date;
  lida: boolean;
  isRead: boolean;
  compradorId: string;
  buyerId: string;
}

function toResponse(n: Notification): NotificationResponse {
  return {
    id: n.id,
    titulo: n.title,
    title: n.title,
    descricao: n.description,
    description: n.description,
    criadoEm: n.createdAt,
    createdAt: n.createdAt,
    lida: n.isRead,
    isRead: n.isRead,
    compradorId: n.buyerId,
    buyerId: n.buyerId,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(
    compradorId: string,
    titulo: string,
    descricao: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.create({
      data: { buyerId: compradorId, title: titulo, description: descricao },
    });
    return toResponse(notification);
  }

  // alias inglês
  async create(buyerId: string, title: string, description: string): Promise<NotificationResponse> {
    return this.criar(buyerId, title, description);
  }

  async findAll(compradorId: string): Promise<NotificationResponse[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { buyerId: compradorId },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(toResponse);
  }

  // alias inglês
  async findAllForBuyer(buyerId: string): Promise<NotificationResponse[]> {
    return this.findAll(buyerId);
  }

  async marcarComoLida(compradorId: string, id: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.buyerId !== compradorId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Notificação não encontrada' },
      });
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return toResponse(updated);
  }

  // alias inglês
  async markAsRead(buyerId: string, id: string): Promise<NotificationResponse> {
    return this.marcarComoLida(buyerId, id);
  }

  async marcarTodasComoLidas(compradorId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { buyerId: compradorId, isRead: false },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  // alias inglês
  async markAllAsRead(buyerId: string): Promise<{ count: number }> {
    return this.marcarTodasComoLidas(buyerId);
  }
}

export const NotificacoesService = NotificationsService;
