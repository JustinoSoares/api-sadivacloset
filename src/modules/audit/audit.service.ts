import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, buildPaginatedResponse } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async register(adminId: string, action: string, entity: string, entityId: string, details?: any) {
    return this.prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId,
        details: details ?? null,
      },
    });
  }

  // Portuguese alias
  async registar(
    adminId: string,
    acao: string,
    entidade: string,
    entidadeId: string,
    detalhes?: any,
  ) {
    return this.register(adminId, acao, entidade, entidadeId, detalhes);
  }

  async list(
    dto: PaginationDto & {
      entidade?: string;
      entity?: string;
      data_inicio?: string;
      dataInicio?: string;
      from?: string;
      data_fim?: string;
      dataFim?: string;
      to?: string;
    },
  ) {
    const where: any = {};

    const entity = (dto as any).entity ?? (dto as any).entidade;
    if (entity) {
      where.entity = String(entity).toLowerCase().trim();
    }

    const start = (dto as any).from ?? (dto as any).data_inicio ?? (dto as any).dataInicio;
    const end = (dto as any).to ?? (dto as any).data_fim ?? (dto as any).dataFim;
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = new Date(start);
      if (end) {
        const e = new Date(end);
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
      action: log.action,
      acao: log.action,
      entity: log.entity,
      entidade: log.entity,
      entityId: log.entityId,
      entidadeId: log.entityId,
      details: log.details,
      detalhes: log.details,
      createdAt: log.createdAt,
      criadoEm: log.createdAt,
    }));

    return buildPaginatedResponse(mapped, total, dto);
  }

  // Portuguese alias
  async listar(dto: any) {
    return this.list(dto);
  }
}

export const AuditoriaService = AuditService;
