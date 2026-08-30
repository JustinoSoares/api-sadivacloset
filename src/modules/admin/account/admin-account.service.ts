import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAccount(adminId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true },
    });
    if (!admin) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Admin não encontrado' },
      });
    }
    return {
      id: admin.id,
      name: admin.name,
      nome: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      criadoEm: admin.createdAt,
      isActive: admin.isActive,
      ativo: admin.isActive,
    };
  }

  // legacy alias
  async getConta(adminId: string) {
    return this.getAccount(adminId);
  }

  async updateAccount(
    adminId: string,
    data: { name?: string; email?: string; currentPassword?: string; newPassword?: string },
  ) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Admin não encontrado' },
      });
    }

    const isPasswordChange = data.newPassword !== undefined;

    if (isPasswordChange && !data.currentPassword) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'passwordActual é obrigatória para trocar password',
          detalhes: [{ campo: 'passwordActual', erros: ['obrigatória'] }],
        },
      });
    }

    if (isPasswordChange && data.currentPassword) {
      const ok = await bcrypt.compare(data.currentPassword, admin.passwordHash);
      if (!ok) {
        throw new BadRequestException({
          erro: { codigo: 'PASSWORD_ACTUAL_INCORRECTA', mensagem: 'Password actual incorrecta' },
        });
      }
      if (data.newPassword === data.currentPassword) {
        throw new BadRequestException({
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Nova password deve ser diferente da actual',
          },
        });
      }
    }

    if (data.email && data.email !== admin.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (exists && exists.id !== adminId) {
        throw new ConflictException({
          erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Este email já está em uso' },
        });
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (isPasswordChange && data.newPassword) {
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return this.getAccount(adminId);
    }

    const updated = await this.prisma.user.update({
      where: { id: adminId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true, isActive: true },
    });

    const changedFields = Object.keys(updateData).filter((k) => k !== 'passwordHash');
    const details: any = { alteracoes: changedFields };
    if (updateData.passwordHash) details.trocaPassword = true;
    await this.audit
      .register(adminId, 'update_account', 'account', adminId, details)
      .catch(() => {});

    return {
      id: updated.id,
      name: updated.name,
      nome: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      criadoEm: updated.createdAt,
      isActive: updated.isActive,
      ativo: updated.isActive,
    };
  }

  // legacy alias for Portuguese callers
  async updateConta(
    adminId: string,
    data: { nome?: string; email?: string; passwordActual?: string; novaPassword?: string },
  ) {
    return this.updateAccount(adminId, {
      name: data.nome,
      email: data.email,
      currentPassword: data.passwordActual,
      newPassword: data.novaPassword,
    });
  }
}

// legacy export
export const AdminContaService = AdminAccountService;
