import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminContaService } from './admin-conta.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('AdminContaService', () => {
  let service: AdminContaService;
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
        { provide: AuditoriaService, useValue: { registar: jest.fn().mockResolvedValue({}) } },
        AdminContaService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AdminContaService>(AdminContaService);
  });

  it('GET deve retornar dados do admin', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    const result = await service.getConta(adminId);
    expect(result.nome).toBe('Admin');
    expect(result.email).toBe('admin@sadivacloset.local');
  });

  it('PATCH deve atualizar nome/email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(adminMock).mockResolvedValueOnce(null); // check conflict
    prisma.user.update.mockResolvedValue({
      ...adminMock,
      name: 'Novo Nome',
      email: 'novo@a.ao',
    } as any);
    const result = await service.updateConta(adminId, { nome: 'Novo Nome', email: 'novo@a.ao' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Novo Nome', email: 'novo@a.ao' }),
      }),
    );
    expect(result.nome).toBe('Novo Nome');
  });

  it('PATCH deve exigir passwordActual para trocar password', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    await expect(
      service.updateConta(adminId, { novaPassword: 'NewPass123!' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH deve falhar se passwordActual incorrecta', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    await expect(
      service.updateConta(adminId, { passwordActual: 'WrongPass', novaPassword: 'NewPass123!' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH deve trocar password quando actual correcta', async () => {
    prisma.user.findUnique.mockResolvedValue(adminMock);
    prisma.user.update.mockResolvedValue({ ...adminMock, passwordHash: 'newhash' } as any);
    // Mock updateConta internal getConta after update
    prisma.user.findUnique
      .mockResolvedValueOnce(adminMock)
      .mockResolvedValueOnce({ ...adminMock, passwordHash: 'newhash' });
    // Actually updateConta does findUnique for admin, then update; we mock accordingly
    prisma.user.findUnique = jest.fn().mockResolvedValue(adminMock);
    prisma.user.update = jest
      .fn()
      .mockResolvedValue({ ...adminMock, name: 'Admin', email: 'admin@sadivacloset.local' } as any);
    jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true as any);
    jest.spyOn(bcrypt, 'hash').mockImplementation(async () => 'hashedNew' as any);
    const result = await service.updateConta(adminId, {
      passwordActual: 'OldPass123!',
      novaPassword: 'NewPass123!',
    });
    expect(bcrypt.compare).toHaveBeenCalled();
    expect(result).toBeDefined();
    (jest.restoreAllMocks as any)?.();
  });

  it('PATCH deve falhar se email já existe', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(adminMock)
      .mockResolvedValueOnce({ id: 'other', email: 'taken@a.ao' } as any);
    await expect(service.updateConta(adminId, { email: 'taken@a.ao' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
