import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registar(
    adminId: string,
    acao: string,
    entidade: string,
    entidadeId: string,
    detalhes?: any,
  ) {
    return this.prisma.auditLog.create({
      data: {
        adminId,
        action: acao,
        entity: entidade,
        entityId: entidadeId,
        details: detalhes ?? null,
      },
    });
  }

  // alias inglês
  async register(adminId: string, action: string, entity: string, entityId: string, details?: any) {
    return this.registar(adminId, action, entity, entityId, details);
  }

  async listar(dto: PaginationDto & { entidade?: string; entity?: string; data_inicio?: string; dataInicio?: string; from?: string; data_fim?: string; dataFim?: string; to?: string }) {
    const where: any = {};

    const entidade = (dto as any).entidade ?? (dto as any).entity;
    if (entidade) {
      where.entity = String(entidade).toLowerCase().trim();
    }

    const inicio = (dto as any).data_inicio ?? (dto as any).dataInicio ?? (dto as any).from;
    const fim = (dto as any).data_fim ?? (dto as any).dataFim ?? (dto as any).to;
    if (inicio || fim) {
      where.createdAt = {};
      if (inicio) where.createdAt.gte = new Date(inicio);
      if (fim) {
        const e = new Date(fim);
        e.setHours(23, 59, 59, 999);
        where.createdAt.lte = e;
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.take,
      }),
    ]);

    const mapped = logs.map((log: any) => ({
      id: log.id,
      adminId: log.adminId,
      admin_id: log.adminId,
      acao: log.action,
      action: log.action,
      entidade: log.entity,
      entity: log.entity,
      entidadeId: log.entityId,
      entityId: log.entityId,
      detalhes: log.details,
      details: log.details,
      criadoEm: log.createdAt,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResponse(mapped, total, dto);
  }
}

export const AuditService = AuditoriaService;
