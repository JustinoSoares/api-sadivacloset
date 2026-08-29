import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { AdminPreferencesService } from './admin-preferences.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';

describe('AdminPreferencesService', () => {
  let service: AdminPreferencesService;
  let prisma: any;

  const prefMock = {
    id: 'singleton',
    notifyNewOrders: true,
    notifyLowStock: true,
    notifyNewMessages: true,
    defaultDeliveryFee: 3000,
    activePaymentMethods: [PaymentMethod.MULTICAIXA_EXPRESS, PaymentMethod.BANK_TRANSFER],
  };

  beforeEach(async () => {
    prisma = {
      adminPreferences: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditService, useValue: { register: jest.fn().mockResolvedValue({}), registar: jest.fn().mockResolvedValue({}) } },
        AdminPreferencesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AdminPreferencesService>(AdminPreferencesService);
  });

  it('GET should return existing preferences', async () => {
    prisma.adminPreferences.findUnique.mockResolvedValue(prefMock);
    const result = await service.getPreferences();
    expect(result.defaultDeliveryFee).toBe(3000);
    expect(result.taxaEntregaPadrao).toBe(3000);
    expect(result.notifyNewOrders).toBe(true);
    expect(result.notificarNovosPedidos).toBe(true);
  });

  it('GET should create singleton if not exists', async () => {
    prisma.adminPreferences.findUnique.mockResolvedValue(null);
    prisma.adminPreferences.create.mockResolvedValue(prefMock);
    const result = await service.getPreferences();
    expect(prisma.adminPreferences.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('PATCH should update via upsert with bilingual aliases', async () => {
    prisma.adminPreferences.upsert.mockResolvedValue({
      ...prefMock,
      notifyNewOrders: false,
      defaultDeliveryFee: 5000,
      activePaymentMethods: [PaymentMethod.CARD],
    });
    const result = await service.updatePreferences({
      notifyNewOrders: false,
      defaultDeliveryFee: 5000,
      activePaymentMethods: [PaymentMethod.CARD],
    });
    expect(prisma.adminPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ notifyNewOrders: false, defaultDeliveryFee: 5000 }) }),
    );
    expect(result.notifyNewOrders).toBe(false);
    expect(result.notificarNovosPedidos).toBe(false);
    expect(result.defaultDeliveryFee).toBe(5000);
    expect(result.taxaEntregaPadrao).toBe(5000);
  });

  it('legacy alias getPreferencias should work', async () => {
    prisma.adminPreferences.findUnique.mockResolvedValue(prefMock);
    const result = await service.getPreferencias();
    expect(result.defaultDeliveryFee).toBe(3000);
  });

  it('legacy alias updatePreferencias should map Portuguese keys', async () => {
    prisma.adminPreferences.upsert.mockResolvedValue({
      ...prefMock,
      notifyNewOrders: false,
    });
    const result = await service.updatePreferencias({
      notificarNovosPedidos: false,
    });
    expect(prisma.adminPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ notifyNewOrders: false }) }),
    );
    expect(result.notificarNovosPedidos).toBe(false);
  });
});

// legacy suite name for backward compat
describe('AdminPreferenciasService', () => {
  it('alias should exist', () => {
    expect(AdminPreferencesService).toBeDefined();
  });
});
