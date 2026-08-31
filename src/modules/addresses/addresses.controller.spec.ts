import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PerfilEnderecosController, ProfileAddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';

describe('PerfilEnderecosController', () => {
  let perfilController: PerfilEnderecosController;
  let profileController: ProfileAddressesController;
  let service: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    setDefault: jest.Mock;
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const addressId = '22222222-2222-2222-2222-222222222222';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'buyer' } as any;

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
    service = {
      findAll: jest.fn().mockResolvedValue([addressMock]),
      create: jest.fn().mockResolvedValue(addressMock),
      update: jest.fn().mockResolvedValue(addressMock),
      remove: jest.fn().mockResolvedValue(undefined),
      setDefault: jest.fn().mockResolvedValue(addressMock),
    };

    const mod = await Test.createTestingModule({
      controllers: [PerfilEnderecosController, ProfileAddressesController],
      providers: [{ provide: AddressesService, useValue: service }],
    }).compile();

    perfilController = mod.get(PerfilEnderecosController);
    profileController = mod.get(ProfileAddressesController);
  });

  it('GET /perfil/enderecos should return {data} English-only', async () => {
    const result = await perfilController.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(buyerId);
    expect(result).toEqual({ data: [addressMock] });
  });

  it('POST /perfil/enderecos should validate required fields', async () => {
    const dto = new CreateAddressDto();
    dto.label = 'Casa';
    dto.province = 'Luanda';
    dto.municipality = 'Talatona';
    dto.neighborhood = 'Benfica';
    dto.street = 'Rua 1';
    const result = await perfilController.create(user, dto);
    expect(service.create).toHaveBeenCalledWith(
      buyerId,
      expect.objectContaining({ label: 'Casa' }),
    );
    expect(result).toEqual({ data: addressMock });
  });

  it('POST should throw 400 if missing fields', async () => {
    const dto = new CreateAddressDto();
    dto.label = 'Casa';
    // missing provincia etc
    await expect(perfilController.create(user, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH /perfil/enderecos/:id should edit', async () => {
    const dto = new UpdateAddressDto();
    dto.label = 'Casa Nova';
    await perfilController.update(user, addressId, dto);
    expect(service.update).toHaveBeenCalledWith(
      buyerId,
      addressId,
      expect.objectContaining({ label: 'Casa Nova' }),
    );
  });

  it('DELETE /perfil/enderecos/:id should remove', async () => {
    const result = await perfilController.remove(user, addressId);
    expect(service.remove).toHaveBeenCalledWith(buyerId, addressId);
    expect(result).toEqual({ message: 'Address removed', data: null });
  });

  it('PATCH /perfil/enderecos/:id/predefinir should set default', async () => {
    const result = await perfilController.setDefault(user, addressId);
    expect(service.setDefault).toHaveBeenCalledWith(buyerId, addressId);
    expect(result).toEqual({ data: addressMock });
  });

  it('aliases /profile/addresses should mirror', async () => {
    await profileController.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(buyerId);
    const dto = new CreateAddressDto();
    dto.label = 'Home';
    dto.province = 'Luanda';
    dto.municipality = 'Talatona';
    dto.neighborhood = 'Benfica';
    dto.street = 'Rua 1';
    await profileController.create(user, dto);
    expect(service.create).toHaveBeenCalled();
    await profileController.setDefault(user, addressId);
    expect(service.setDefault).toHaveBeenCalledWith(buyerId, addressId);
  });

  it('should have correct paths', () => {
    expect(Reflect.getMetadata('path', PerfilEnderecosController)).toBe('perfil/enderecos');
    expect(Reflect.getMetadata('path', ProfileAddressesController)).toBe('profile/addresses');
  });
});
