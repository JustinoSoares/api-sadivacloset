import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { PaymentMethod } from '@prisma/client';

function toResponse(pref: any) {
  return {
    id: pref.id,
    notificarNovosPedidos: pref.notifyNewOrders,
    notifyNewOrders: pref.notifyNewOrders,
    notificarStockBaixo: pref.notifyLowStock,
    notifyLowStock: pref.notifyLowStock,
    notificarNovasMensagens: pref.notifyNewMessages,
    notifyNewMessages: pref.notifyNewMessages,
    taxaEntregaPadrao: pref.defaultDeliveryFee,
    defaultDeliveryFee: pref.defaultDeliveryFee,
    metodosPagamentoAtivos: pref.activePaymentMethods,
    activePaymentMethods: pref.activePaymentMethods,
  };
}

@Injectable()
export class AdminPreferenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async getPreferencias() {
    let pref = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    if (!pref) {
      pref = await this.prisma.adminPreferences.create({
        data: {
          id: 'singleton',
          notifyNewOrders: true,
          notifyLowStock: true,
          notifyNewMessages: true,
          defaultDeliveryFee: 3000,
          activePaymentMethods: [PaymentMethod.MULTICAIXA_EXPRESS, PaymentMethod.MULTICAIXA_REFERENCE, PaymentMethod.BANK_TRANSFER],
        },
      });
    }
    return toResponse(pref);
  }

  async updatePreferencias(
    data: {
      notificarNovosPedidos?: boolean;
      notificarStockBaixo?: boolean;
      notificarNovasMensagens?: boolean;
      taxaEntregaPadrao?: number;
      metodosPagamentoAtivos?: PaymentMethod[];
    },
    adminId?: string,
  ) {
    const before = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    const payload: any = {};
    if (data.notificarNovosPedidos !== undefined) payload.notifyNewOrders = data.notificarNovosPedidos;
    if (data.notificarStockBaixo !== undefined) payload.notifyLowStock = data.notificarStockBaixo;
    if (data.notificarNovasMensagens !== undefined) payload.notifyNewMessages = data.notificarNovasMensagens;
    if (data.taxaEntregaPadrao !== undefined) payload.defaultDeliveryFee = data.taxaEntregaPadrao;
    if (data.metodosPagamentoAtivos !== undefined) payload.activePaymentMethods = data.metodosPagamentoAtivos;

    const updated = await this.prisma.adminPreferences.upsert({
      where: { id: 'singleton' },
      update: payload,
      create: {
        id: 'singleton',
        notifyNewOrders: payload.notifyNewOrders ?? true,
        notifyLowStock: payload.notifyLowStock ?? true,
        notifyNewMessages: payload.notifyNewMessages ?? true,
        defaultDeliveryFee: payload.defaultDeliveryFee ?? 3000,
        activePaymentMethods: payload.activePaymentMethods ?? [PaymentMethod.MULTICAIXA_EXPRESS, PaymentMethod.MULTICAIXA_REFERENCE, PaymentMethod.BANK_TRANSFER],
      },
    });
    if (adminId) {
      await this.auditoria.registar(adminId, 'atualizar_preferencias', 'preferencias', 'singleton', { antes: before, depois: updated, alteracoes: payload }).catch(() => {});
    }
    return toResponse(updated);
  }
}
