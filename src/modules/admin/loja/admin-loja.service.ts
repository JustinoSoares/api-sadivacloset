import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';

function toResponse(config: any) {
  return {
    id: config.id,
    name: config.name,
    contactEmail: config.contactEmail,
    phone: config.phone,
    address: config.address,
  };
}

@Injectable()
export class AdminLojaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async getLoja() {
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

  async updateLoja(
    data: { nome?: string; email?: string; telefone?: string; morada?: string },
    adminId?: string,
  ) {
    const payload: any = {};
    if (data.nome !== undefined) payload.name = data.nome;
    if (data.email !== undefined) payload.contactEmail = data.email;
    if (data.telefone !== undefined) payload.phone = data.telefone;
    if (data.morada !== undefined) payload.address = data.morada;

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
      await this.auditoria
        .registar(adminId, 'update_store', 'store', 'singleton', {
          before,
          after: updated,
          changes: payload,
        })
        .catch(() => {});
    }
    return toResponse(updated);
  }
}
