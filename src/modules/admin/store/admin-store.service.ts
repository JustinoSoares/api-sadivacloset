import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

function toResponse(config: any) {
  return {
    id: config.id,
    name: config.name,
    nome: config.name,
    contactEmail: config.contactEmail,
    email: config.contactEmail,
    email_contacto: config.contactEmail,
    phone: config.phone,
    telefone: config.phone,
    address: config.address,
    morada: config.address,
  };
}

@Injectable()
export class AdminStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getStore() {
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
    return toResponse(config);
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
