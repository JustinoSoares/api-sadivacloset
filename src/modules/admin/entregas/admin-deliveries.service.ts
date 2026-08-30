import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { PaginationDto, buildPaginatedResponse } from '../../../common/dto/pagination.dto';
import { FilterDeliveriesDto } from './dto/filter-deliveries.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

function toDeliveryResponse(delivery: any) {
  return {
    id: delivery.id,
    pedido_id: delivery.orderId,
    order_id: delivery.orderId,
    orderId: delivery.orderId,
    tipo: delivery.type,
    type: delivery.type,
    endereco_id: delivery.addressId,
    address_id: delivery.addressId,
    addressId: delivery.addressId,
    data_agendada: delivery.scheduledDate,
    scheduled_date: delivery.scheduledDate,
    scheduledDate: delivery.scheduledDate,
    janela_horario: delivery.timeWindow,
    time_window: delivery.timeWindow,
    timeWindow: delivery.timeWindow,
    estado: delivery.status,
    status: delivery.status,
    taxa_entrega: delivery.deliveryFee,
    delivery_fee: delivery.deliveryFee,
    deliveryFee: delivery.deliveryFee,
    instrucoes: delivery.instructions ?? null,
    instructions: delivery.instructions ?? null,
    pedido: delivery.order
      ? {
          id: delivery.order.id,
          comprador_id: delivery.order.buyerId,
          buyerId: delivery.order.buyerId,
          estado: delivery.order.status,
          status: delivery.order.status,
          total: delivery.order.total,
          criado_em: delivery.order.createdAt,
          createdAt: delivery.order.createdAt,
        }
      : undefined,
    order: delivery.order,
  };
}

@Injectable()
export class AdminDeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async findAll(dto: FilterDeliveriesDto) {
    const where: any = {};

    const estado = dto.estadoNormalized;
    if (estado) {
      where.status = estado;
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

    await this.auditoria.registar(adminId, 'atualizar_estado_entrega', 'entrega', deliveryId, {
      de: delivery.status,
      para: newStatus,
      estado: newStatus,
    });

    try {
      await this.notificationsService.criar(
        delivery.order.buyerId,
        'Entrega atualizada',
        `O estado da entrega do pedido #${delivery.orderId.slice(0, 8)} foi atualizado para ${normalized} (${newStatus})`,
      );
    } catch {}

    return toDeliveryResponse(updated);
  }
}
