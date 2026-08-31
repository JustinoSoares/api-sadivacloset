import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AddressesService, EnderecosService } from './addresses.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

describe('AddressesService', () => {
  let service: AddressesService;
  let prisma: {
    address: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    delivery: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const otherBuyerId = '99999999-9999-9999-9999-999999999999';
  const addressId = '22222222-2222-2222-2222-222222222222';
  const addressMock = {
    id: addressId,
    buyerId,
    label: 'Casa',
    province: 'Luanda',
    municipality: 'Talatona',
    neighborhood: 'Benfica',
    street: 'Rua 1',
    reference: null,
    latitude: null,
    longitude: null,
    isDefault: true,
  };

  beforeEach(async () => {
    prisma = {
      address: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      delivery: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AddressesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should list with isDefault English-only', async () => {
      prisma.address.findMany.mockResolvedValue([addressMock]);
      const result = await service.findAll(buyerId);
      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { buyerId },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Casa');
      expect(result[0].isDefault).toBe(true);
    });
  });

  describe('create', () => {
    it('should mark first address as isDefault=true', async () => {
      prisma.address.count.mockResolvedValue(0);
      prisma.address.create.mockResolvedValue(addressMock);
      const result = await service.create(buyerId, {
        label: 'Casa',
        province: 'Luanda',
        municipality: 'Talatona',
        neighborhood: 'Benfica',
        street: 'Rua 1',
        reference: null,
        latitude: null,
        longitude: null,
      });
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: true }),
      });
      expect(result.isDefault).toBe(true);
    });

    it('should create subsequent address as isDefault=false', async () => {
      prisma.address.count.mockResolvedValue(1);
      prisma.address.create.mockResolvedValue({ ...addressMock, id: '3333', isDefault: false });
      const result = await service.create(buyerId, {
        label: 'Trabalho',
        province: 'Luanda',
        municipality: 'Ingombota',
        neighborhood: 'Maianga',
        street: 'Rua 2',
        reference: 'ref',
        latitude: -8.8,
        longitude: 13.2,
      });
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: false }),
      });
      expect(result.isDefault).toBe(false);
    });

    it('should handle bilingual mapping', async () => {
      prisma.address.count.mockResolvedValue(0);
      prisma.address.create.mockResolvedValue(addressMock);
      await service.create(buyerId, {
        label: 'Casa',
        province: 'Luanda',
        municipality: 'Talatona',
        neighborhood: 'Benfica',
        street: 'Rua 1',
      } as any);
      expect(prisma.address.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should edit own address', async () => {
      prisma.address.findUnique.mockResolvedValue(addressMock);
      prisma.address.update.mockResolvedValue({ ...addressMock, label: 'Casa Nova' });
      const result = await service.update(buyerId, addressId, { label: 'Casa Nova' });
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: addressId },
        data: { label: 'Casa Nova' },
      });
      expect(result.label).toBe('Casa Nova');
    });

    it('should throw 404 if not owner', async () => {
      prisma.address.findUnique.mockResolvedValue({ ...addressMock, buyerId: otherBuyerId });
      await expect(service.update(buyerId, addressId, { label: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.address.findUnique.mockResolvedValue(null);
      await expect(service.update(buyerId, addressId, { label: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove when multiple addresses', async () => {
      prisma.address.findUnique.mockResolvedValue(addressMock);
      prisma.address.count.mockResolvedValue(2);
      prisma.address.delete.mockResolvedValue({});
      prisma.address.findFirst.mockResolvedValue(null);
      await service.remove(buyerId, addressId);
      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: addressId } });
    });

    it('should throw 404 if not owner', async () => {
      prisma.address.findUnique.mockResolvedValue(null);
      await expect(service.remove(buyerId, addressId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should block when único com pedidos pendentes', async () => {
      prisma.address.findUnique.mockResolvedValue(addressMock);
      prisma.address.count.mockResolvedValue(1);
      prisma.delivery.findFirst.mockResolvedValue({
        id: 'del1',
        addressId,
        order: { status: OrderStatus.AWAITING_PAYMENT },
      });
      await expect(service.remove(buyerId, addressId)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remove(buyerId, addressId)).rejects.toMatchObject({
        response: { error: { code: 'ADDRESS_IN_USE' } },
      });
      expect(prisma.address.delete).not.toHaveBeenCalled();
    });

    it('should allow remove único sem pedidos pendentes', async () => {
      prisma.address.findUnique.mockResolvedValue(addressMock);
      prisma.address.count.mockResolvedValue(1);
      prisma.delivery.findFirst.mockResolvedValue(null);
      prisma.address.delete.mockResolvedValue({});
      prisma.address.findFirst.mockResolvedValue(null);
      await service.remove(buyerId, addressId);
      expect(prisma.address.delete).toHaveBeenCalled();
    });

    it('should promote remaining to default if deleted was default', async () => {
      prisma.address.findUnique.mockResolvedValue({ ...addressMock, isDefault: true });
      prisma.address.count.mockResolvedValue(2);
      prisma.address.delete.mockResolvedValue({});
      prisma.address.findFirst.mockResolvedValue({
        id: 'remaining-id',
        buyerId,
        isDefault: false,
      } as any);
      prisma.address.update.mockResolvedValue({});
      await service.remove(buyerId, addressId);
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'remaining-id' },
        data: { isDefault: true },
      });
    });
  });

  describe('setDefault', () => {
    it('should desmarca restantes e marca este', async () => {
      prisma.address.findUnique.mockResolvedValue(addressMock);
      const updatedMock = { ...addressMock, isDefault: true };
      prisma.$transaction.mockResolvedValue([{}, updatedMock]);
      const result = await service.setDefault(buyerId, addressId);
      expect(prisma.$transaction).toHaveBeenCalled();
      const calls = prisma.$transaction.mock.calls[0][0] as any[];
      expect(calls).toHaveLength(2);
      expect(result.isDefault).toBe(true);
    });

    it('should throw 404 if not owner', async () => {
      prisma.address.findUnique.mockResolvedValue(null);
      await expect(service.setDefault(buyerId, addressId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      prisma.address.findUnique.mockResolvedValue({ ...addressMock, buyerId: otherBuyerId });
      await expect(service.setDefault(buyerId, addressId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('legacy EnderecosService alias should exist', () => {
    expect(EnderecosService).toBeDefined();
    expect(EnderecosService).toBe(AddressesService);
  });
});
