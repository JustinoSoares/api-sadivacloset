import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PaymentMethod } from '@prisma/client';

function toResponse(pref: any) {
  return {
    id: pref.id,
    notifyNewOrders: pref.notifyNewOrders,
    notifyLowStock: pref.notifyLowStock,
    notifyNewMessages: pref.notifyNewMessages,
    defaultDeliveryFee: pref.defaultDeliveryFee,
    activePaymentMethods: pref.activePaymentMethods,
  };
}

@Injectable()
export class AdminPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPreferences() {
    let pref = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    if (!pref) {
      pref = await this.prisma.adminPreferences.create({
        data: {
          id: 'singleton',
          notifyNewOrders: true,
          notifyLowStock: true,
          notifyNewMessages: true,
          defaultDeliveryFee: 3000,
          activePaymentMethods: [
            PaymentMethod.MULTICAIXA_EXPRESS,
            PaymentMethod.MULTICAIXA_REFERENCE,
            PaymentMethod.BANK_TRANSFER,
          ],
        },
      });
    }
    return toResponse(pref);
  }

  // legacy alias
  async getPreferencias() {
    return this.getPreferences();
  }

  async updatePreferences(
    data: {
      notifyNewOrders?: boolean;
      notifyLowStock?: boolean;
      notifyNewMessages?: boolean;
      defaultDeliveryFee?: number;
      activePaymentMethods?: PaymentMethod[];
    },
    adminId?: string,
  ) {
    const before = await this.prisma.adminPreferences.findUnique({ where: { id: 'singleton' } });
    const payload: any = {};
    if (data.notifyNewOrders !== undefined) payload.notifyNewOrders = data.notifyNewOrders;
    if (data.notifyLowStock !== undefined) payload.notifyLowStock = data.notifyLowStock;
    if (data.notifyNewMessages !== undefined) payload.notifyNewMessages = data.notifyNewMessages;
    if (data.defaultDeliveryFee !== undefined) payload.defaultDeliveryFee = data.defaultDeliveryFee;
    if (data.activePaymentMethods !== undefined)
      payload.activePaymentMethods = data.activePaymentMethods;

    const updated = await this.prisma.adminPreferences.upsert({
      where: { id: 'singleton' },
      update: payload,
      create: {
        id: 'singleton',
        notifyNewOrders: payload.notifyNewOrders ?? true,
        notifyLowStock: payload.notifyLowStock ?? true,
        notifyNewMessages: payload.notifyNewMessages ?? true,
        defaultDeliveryFee: payload.defaultDeliveryFee ?? 3000,
        activePaymentMethods: payload.activePaymentMethods ?? [
          PaymentMethod.MULTICAIXA_EXPRESS,
          PaymentMethod.MULTICAIXA_REFERENCE,
          PaymentMethod.BANK_TRANSFER,
        ],
      },
    });
    if (adminId) {
      await this.audit
        .register(adminId, 'update_preferences', 'preferences', 'singleton', {
          before,
          after: updated,
          changes: payload,
        })
        .catch(() => {});
    }
    return toResponse(updated);
  }

  // legacy alias for Portuguese callers
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
    return this.updatePreferences(
      {
        notifyNewOrders: data.notificarNovosPedidos,
        notifyLowStock: data.notificarStockBaixo,
        notifyNewMessages: data.notificarNovasMensagens,
        defaultDeliveryFee: data.taxaEntregaPadrao,
        activePaymentMethods: data.metodosPagamentoAtivos,
      },
      adminId,
    );
  }
}

// legacy export
export const AdminPreferenciasService = AdminPreferencesService;
