import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

function toDeliveryResponse(delivery: any) {
  return {
    id: delivery.id,
    orderId: delivery.orderId,
    order_id: delivery.orderId,
    pedido_id: delivery.orderId,
    type: delivery.type,
    tipo: delivery.type,
    addressId: delivery.addressId,
    address_id: delivery.addressId,
    endereco_id: delivery.addressId,
    scheduledDate: delivery.scheduledDate,
    scheduled_date: delivery.scheduledDate,
    data_agendada: delivery.scheduledDate,
    timeWindow: delivery.timeWindow,
    time_window: delivery.timeWindow,
    janela_horario: delivery.timeWindow,
    status: delivery.status,
    estado: delivery.status,
    deliveryFee: delivery.deliveryFee,
    delivery_fee: delivery.deliveryFee,
    taxa_entrega: delivery.deliveryFee,
    instructions: delivery.instructions ?? null,
    instrucoes: delivery.instructions ?? null,
    order: delivery.order,
    pedido: delivery.order
      ? {
          id: delivery.order.id,
          buyerId: delivery.order.buyerId,
          comprador_id: delivery.order.buyerId,
          status: delivery.order.status,
          estado: delivery.order.status,
          total: delivery.order.total,
          createdAt: delivery.order.createdAt,
          criado_em: delivery.order.createdAt,
        }
      : undefined,
  };
}

@Injectable()
export class AdminDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async findAll(dto: FilterDeliveriesDto) {
    const where: any = {};

    const status = dto.estadoNormalized;
    if (status) {
      where.status = status;
    }

    const start = dto.startDateNormalized;
    const end = dto.endDateNormalized;
    if (start || end) {
      where.scheduledDate = {};
      if (start) where.scheduledDate.gte = new Date(start);
      if (end) {
        const e = new Date(end);
        e.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = e;
      }
    }

    const [total, deliveries] = await Promise.all([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        include: { order: true, address: true },
        orderBy: { scheduledDate: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const mapped = deliveries.map(toDeliveryResponse);
    return buildPaginatedResponse(mapped, total, dto);
  }

  async updateStatus(adminId: string, deliveryId: string, dto: UpdateDeliveryStatusDto) {
    const normalized = dto.estadoNormalized;
    if (!normalized || !UpdateDeliveryStatusDto.isValid(normalized)) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Estado inválido',
          detalhes: [
            {
              campo: 'estado',
              erros: [`estado deve ser um de: agendada, a_caminho, entregue, falhada, cancelada`],
            },
          ],
        },
      });
    }
    const newStatus = UpdateDeliveryStatusDto.toEnum(normalized);

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true },
    });
    if (!delivery) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Entrega não encontrada' },
      });
    }

    if (delivery.status === newStatus) {
      return toDeliveryResponse(delivery);
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: newStatus },
      include: { order: true, address: true },
    });

    await this.audit.register(adminId, 'update_delivery_status', 'delivery', deliveryId, {
      from: delivery.status,
      to: newStatus,
      status: newStatus,
      de: delivery.status,
      para: newStatus,
      estado: newStatus,
    });

    try {
      const notif: any = this.notificationsService as any;
      if (typeof notif.create === 'function') {
        await notif.create(
          delivery.order.buyerId,
          'Entrega atualizada',
          `O estado da entrega do pedido #${delivery.orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
        );
      } else if (typeof notif.criar === 'function') {
        await notif.criar(
          delivery.order.buyerId,
          'Entrega atualizada',
          `O estado da entrega do pedido #${delivery.orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
        );
      }
    } catch {}

    return toDeliveryResponse(updated);
  }
}

// legacy alias
export const AdminEntregasService = AdminDeliveriesService;
