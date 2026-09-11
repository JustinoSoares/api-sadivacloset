import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RedisService } from '../../redis/redis.service';

function toResponse(config: any) {
  return {
    id: config.id,
    name: config.name,
    contactEmail: config.contactEmail,
    phone: config.phone,
    address: config.address,
  };
}

const CACHE_KEY = 'cache:store:config';
const CACHE_TTL = 300; // 5min — dados raramente alteram, TTL curto economiza memória e evita stale

@Injectable()
export class AdminStoreService {
  private readonly logger = new Logger(AdminStoreService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async getStore() {
    // Redis primeiro — evita DB em 99% dos GET
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      this.logger.warn(`Redis get ${CACHE_KEY} falhou: ${(e as Error).message}`);
    }

    let config = await this.prisma.storeConfig.findUnique({ where: { id: 'singleton' } });
    if (!config) {
      config = await this.prisma.storeConfig.create({
        data: {
          id: 'singleton',
          name: 'SadivaCloset',
          contactEmail: 'contacto@sadivacloset.co.ao',
          phone: '+244 900 000 000',
          address: 'Luanda, Talatona',
        },
      });
    }
    const res = toResponse(config);
    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(res), CACHE_TTL);
    } catch (e) {
      this.logger.warn(`Redis set ${CACHE_KEY} falhou: ${(e as Error).message}`);
    }
    return res;
  }

  async getLoja() {
    return this.getStore();
  }

  async updateStore(
    data: { name?: string; email?: string; phone?: string; address?: string },
    adminId?: string,
  ) {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.email !== undefined) payload.contactEmail = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.address !== undefined) payload.address = data.address;

    const before = await this.prisma.storeConfig.findUnique({ where: { id: 'singleton' } });
    const updated = await this.prisma.storeConfig.upsert({
      where: { id: 'singleton' },
      update: payload,
      create: {
        id: 'singleton',
        name: payload.name ?? 'SadivaCloset',
        contactEmail: payload.contactEmail ?? 'contacto@sadivacloset.co.ao',
        phone: payload.phone ?? '+244 900 000 000',
        address: payload.address ?? 'Luanda, Talatona',
      },
    });
    // Invalida cache imediatamente — próximo GET recarrega do DB
    try {
      await this.redis.del(CACHE_KEY);
      this.logger.log(`Cache invalidado ${CACHE_KEY}`);
    } catch {}
    if (adminId) {
      await this.audit
        .register(adminId, 'update_store', 'store', 'singleton', {
          before,
          after: updated,
          changes: payload,
        })
        .catch(() => {});
    }
    return toResponse(updated);
  }

  async updateLoja(
    data: { nome?: string; email?: string; telefone?: string; morada?: string },
    adminId?: string,
  ) {
    return this.updateStore(
      {
        name: data.nome,
        email: data.email,
        phone: data.telefone,
        address: data.morada,
      },
      adminId,
    );
  }
}

export const AdminLojaService = AdminStoreService;
