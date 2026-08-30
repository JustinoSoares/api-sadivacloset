import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AdminPreferenciasService } from './admin-preferencias.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';

describe('AdminPreferenciasService', () => {
  let service: AdminPreferenciasService;
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
        { provide: AuditoriaService, useValue: { registar: jest.fn().mockResolvedValue({}) } },
        AdminPreferenciasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AdminPreferenciasService>(AdminPreferenciasService);
  });

  it('GET deve retornar preferências existentes', async () => {
    prisma.adminPreferences.findUnique.mockResolvedValue(prefMock);
    const result = await service.getPreferencias();
    expect(result.taxaEntregaPadrao).toBe(3000);
    expect(result.defaultDeliveryFee).toBe(3000);
    expect(result.notificarNovosPedidos).toBe(true);
  });

  it('GET deve criar singleton se não existir', async () => {
    prisma.adminPreferences.findUnique.mockResolvedValue(null);
    prisma.adminPreferences.create.mockResolvedValue(prefMock);
    const result = await service.getPreferencias();
    expect(prisma.adminPreferences.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('PATCH deve atualizar via upsert com aliases bilíngues', async () => {
    prisma.adminPreferences.upsert.mockResolvedValue({
      ...prefMock,
      notifyNewOrders: false,
      defaultDeliveryFee: 5000,
      activePaymentMethods: [PaymentMethod.CARD],
    });
    const result = await service.updatePreferencias({
      notificarNovosPedidos: false,
      taxaEntregaPadrao: 5000,
      metodosPagamentoAtivos: [PaymentMethod.CARD],
    });
    expect(prisma.adminPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ notifyNewOrders: false, defaultDeliveryFee: 5000 }),
      }),
    );
    expect(result.notificarNovosPedidos).toBe(false);
    expect(result.taxaEntregaPadrao).toBe(5000);
  });
});
