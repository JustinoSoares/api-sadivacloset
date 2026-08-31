import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationResponse {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  isRead: boolean;
  buyerId: string;
}

function toResponse(n: Notification): NotificationResponse {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    createdAt: n.createdAt,
    isRead: n.isRead,
    buyerId: n.buyerId,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(
    buyerId: string,
    title: string,
    description: string,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.create({
      data: { buyerId, title, description },
    });
    return toResponse(notification);
  }

  // alias inglês
  async create(buyerId: string, title: string, description: string): Promise<NotificationResponse> {
    return this.criar(buyerId, title, description);
  }

  async findAll(buyerId: string): Promise<NotificationResponse[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(toResponse);
  }

  // alias inglês
  async findAllForBuyer(buyerId: string): Promise<NotificationResponse[]> {
    return this.findAll(buyerId);
  }

  async marcarComoLida(buyerId: string, id: string): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.buyerId !== buyerId) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
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

  async marcarTodasComoLidas(buyerId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { buyerId, isRead: false },
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
