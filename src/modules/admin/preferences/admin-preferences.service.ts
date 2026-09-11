import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RedisService } from '../../redis/redis.service';
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

const CACHE_KEY_PREFS = 'cache:admin:preferences';
const CACHE_TTL_PREFS = 300; // 5min

@Injectable()
export class AdminPreferencesService {
  private readonly logger = new Logger(AdminPreferencesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async getPreferences() {
    try {
      const cached = await this.redis.get(CACHE_KEY_PREFS);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      this.logger.warn(`Redis get ${CACHE_KEY_PREFS} falhou: ${(e as Error).message}`);
    }
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
    const res = toResponse(pref);
    try {
      await this.redis.set(CACHE_KEY_PREFS, JSON.stringify(res), CACHE_TTL_PREFS);
    } catch (e) {
      this.logger.warn(`Redis set ${CACHE_KEY_PREFS} falhou: ${(e as Error).message}`);
    }
    return res;
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
    try {
      await this.redis.del(CACHE_KEY_PREFS);
      this.logger.log(`Cache invalidado ${CACHE_KEY_PREFS}`);
    } catch {}
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
