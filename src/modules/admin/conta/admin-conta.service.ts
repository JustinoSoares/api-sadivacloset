import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminContaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async getConta(adminId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true },
    });
    if (!admin) {
      throw new NotFoundException({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Admin não encontrado' } });
    }
    return {
      id: admin.id,
      nome: admin.name,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      criadoEm: admin.createdAt,
      createdAt: admin.createdAt,
      ativo: admin.isActive,
      isActive: admin.isActive,
    };
  }

  async updateConta(
    adminId: string,
    data: { nome?: string; email?: string; passwordActual?: string; novaPassword?: string },
  ) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException({ erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Admin não encontrado' } });
    }

    const isPasswordChange = data.novaPassword !== undefined;

    if (isPasswordChange && !data.passwordActual) {
      throw new BadRequestException({
        erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'passwordActual é obrigatória para trocar password', detalhes: [{ campo: 'passwordActual', erros: ['obrigatória'] }] },
      });
    }

    if (isPasswordChange && data.passwordActual) {
      const ok = await bcrypt.compare(data.passwordActual, admin.passwordHash);
      if (!ok) {
        throw new BadRequestException({
          erro: { codigo: 'PASSWORD_ACTUAL_INCORRECTA', mensagem: 'Password actual incorrecta' },
        });
      }
      if (data.novaPassword === data.passwordActual) {
        throw new BadRequestException({
          erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'Nova password deve ser diferente da actual' },
        });
      }
    }

    if (data.email && data.email !== admin.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (exists && exists.id !== adminId) {
        throw new ConflictException({ erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Este email já está em uso' } });
      }
    }

    const updateData: any = {};
    if (data.nome !== undefined) updateData.name = data.nome;
    if (data.email !== undefined) updateData.email = data.email;
    if (isPasswordChange && data.novaPassword) {
      updateData.passwordHash = await bcrypt.hash(data.novaPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return this.getConta(adminId);
    }

    const updated = await this.prisma.user.update({
      where: { id: adminId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true },
    });

    const changedFields = Object.keys(updateData).filter((k) => k !== 'passwordHash');
    const detalhes: any = { alteracoes: changedFields };
    if (updateData.passwordHash) detalhes.trocaPassword = true;
    await this.auditoria.registar(adminId, 'atualizar_conta', 'conta', adminId, detalhes).catch(() => {});

    return {
      id: updated.id,
      nome: updated.name,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      criadoEm: updated.createdAt,
      createdAt: updated.createdAt,
      ativo: updated.isActive,
      isActive: updated.isActive,
    };
  }
}
