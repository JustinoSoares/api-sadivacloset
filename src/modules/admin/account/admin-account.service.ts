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
        error: { code: 'NOT_FOUND', message: 'Admin not found' },
      });
    }
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      isActive: admin.isActive,
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
        error: { code: 'NOT_FOUND', message: 'Admin not found' },
      });
    }

    const isPasswordChange = data.newPassword !== undefined;

    if (isPasswordChange && !data.currentPassword) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'currentPassword is required to change password',
          details: [{ field: 'currentPassword', errors: ['required'] }],
        },
      });
    }

    if (isPasswordChange && data.currentPassword) {
      const ok = await bcrypt.compare(data.currentPassword, admin.passwordHash);
      if (!ok) {
        throw new BadRequestException({
          error: { code: 'CURRENT_PASSWORD_INCORRECT', message: 'Current password is incorrect' },
        });
      }
      if (data.newPassword === data.currentPassword) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'New password must be different from current',
          },
        });
      }
    }

    if (data.email && data.email !== admin.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (exists && exists.id !== adminId) {
        throw new ConflictException({
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already in use' },
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
    const details: any = { changes: changedFields };
    if (updateData.passwordHash) details.passwordChanged = true;
    await this.audit
      .register(adminId, 'update_account', 'account', adminId, details)
      .catch(() => {});

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
      isActive: updated.isActive,
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
