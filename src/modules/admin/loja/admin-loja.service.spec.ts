import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AdminLojaService } from './admin-loja.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminLojaService', () => {
  let service: AdminLojaService;
  let prisma: any;

  const lojaMock = {
    id: 'singleton',
    name: 'SadivaCloset',
    contactEmail: 'contacto@sadivacloset.co.ao',
    phone: '+244 900 000 000',
    address: 'Luanda, Talatona',
  };

  beforeEach(async () => {
    prisma = {
      storeConfig: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditoriaService, useValue: { registar: jest.fn().mockResolvedValue({}) } },
        AdminLojaService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AdminLojaService>(AdminLojaService);
  });

  it('GET deve retornar loja existente', async () => {
    prisma.storeConfig.findUnique.mockResolvedValue(lojaMock);
    const result = await service.getLoja();
    expect(result.nome).toBe('SadivaCloset');
    expect(result.name).toBe('SadivaCloset');
    expect(result.email).toBe('contacto@sadivacloset.co.ao');
  });

  it('GET deve criar singleton se não existir', async () => {
    prisma.storeConfig.findUnique.mockResolvedValue(null);
    prisma.storeConfig.create.mockResolvedValue(lojaMock);
    const result = await service.getLoja();
    expect(prisma.storeConfig.create).toHaveBeenCalled();
    expect(result.morada).toBe('Luanda, Talatona');
  });

  it('PATCH deve atualizar via upsert com aliases', async () => {
    prisma.storeConfig.upsert.mockResolvedValue({
      ...lojaMock,
      name: 'Nova Loja',
      phone: '+244 911',
    });
    const result = await service.updateLoja({ nome: 'Nova Loja', telefone: '+244 911' });
    expect(prisma.storeConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ name: 'Nova Loja', phone: '+244 911' }),
      }),
    );
    expect(result.nome).toBe('Nova Loja');
  });
});
