import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminAccountService } from './admin-account.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('AdminAccountService', () => {
  let service: AdminAccountService;
  let prisma: any;
  const adminId = 'admin-1111';
  const hashed = bcrypt.hashSync('OldPass123!', 10);

  const adminMock = {
    id: adminId,
    name: 'Admin',
    email: 'admin@sadivacloset.local',
    passwordHash: hashed,
    role: 'ADMIN',
    createdAt: new Date(),
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AuditService,
          useValue: {
            register: jest.fn().mockResolvedValue({}),
            registar: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AuditoriaService,
          useValue: {
            registar: jest.fn().mockResolvedValue({}),
            register: jest.fn().mockResolvedValue({}),
          },
        },
        AdminAccountService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AdminAccountService>(AdminAccountService);
  });

  it('GET should return admin data', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    const result = await service.getAccount(adminId);
    expect(result.name).toBe('Admin');
    expect(result.email).toBe('admin@sadivacloset.local');
  });

  it('GET legacy alias should also return', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    const result = await service.getConta(adminId);
    expect(result.name).toBe('Admin');
  });

  it('PATCH should update name/email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminMock).mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({
      ...adminMock,
      name: 'Novo Nome',
      email: 'novo@a.ao',
    } as any);
    const result = await service.updateAccount(adminId, { name: 'Novo Nome', email: 'novo@a.ao' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Novo Nome', email: 'novo@a.ao' }),
      }),
    );
    expect(result.name).toBe('Novo Nome');
  });

  it('PATCH legacy alias should map Portuguese keys', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminMock).mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({
      ...adminMock,
      name: 'Novo Nome',
      email: 'novo@a.ao',
    } as any);
    const result = await service.updateConta(adminId, { nome: 'Novo Nome', email: 'novo@a.ao' });
    expect(result.name).toBe('Novo Nome');
  });

  it('PATCH should require currentPassword to change password', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    await expect(
      service.updateAccount(adminId, { newPassword: 'NewPass123!' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH should fail if currentPassword incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    await expect(
      service.updateAccount(adminId, { currentPassword: 'WrongPass', newPassword: 'NewPass123!' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH should change password when current correct', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    prisma.user.update.mockResolvedValue({ ...adminMock, passwordHash: 'newhash' } as any);
    prisma.user.findUnique
      .mockResolvedValueOnce(adminMock)
      .mockResolvedValueOnce({ ...adminMock, passwordHash: 'newhash' });
    prisma.user.findUnique = jest.fn().mockResolvedValue(adminMock);
    prisma.user.update = jest
      .fn()
      .mockResolvedValue({ ...adminMock, name: 'Admin', email: 'admin@sadivacloset.local' } as any);
    jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true as any);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedNew' as any);
    const result = await service.updateAccount(adminId, {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
    });
    expect(bcrypt.compare).toHaveBeenCalled();
    expect(result).toBeDefined();
    (jest.restoreAllMocks as any)?.();
  });

  it('PATCH should fail if email already exists', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminMock)
      .mockResolvedValueOnce({ id: 'other', email: 'taken@a.ao' } as any);
    await expect(service.updateAccount(adminId, { email: 'taken@a.ao' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

// legacy suite
describe('AdminContaService', () => {
  it('alias should exist', () => {
    expect(AdminAccountService).toBeDefined();
  });
});
