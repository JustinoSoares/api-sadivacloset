import { Test } from '@nestjs/testing';
import { PerfilFavoritosController, ProfileFavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('PerfilFavoritosController', () => {
  let perfilController: PerfilFavoritosController;
  let profileController: ProfileFavoritesController;
  let service: { findAll: jest.Mock; add: jest.Mock; remove: jest.Mock };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'buyer' } as any;
  const productMock = { id: productId, name: 'Suit' };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([productMock]),
      add: jest.fn().mockResolvedValue(productMock),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const mod = await Test.createTestingModule({
      controllers: [PerfilFavoritosController, ProfileFavoritesController],
      providers: [{ provide: FavoritesService, useValue: service }],
    }).compile();

    perfilController = mod.get(PerfilFavoritosController);
    profileController = mod.get(ProfileFavoritesController);
  });

  it('GET /perfil/favoritos should return {data,dados}', async () => {
    const result = await perfilController.findAll(user);
    expect(service.findAll).toHaveBeenCalledWith(buyerId);
    expect(result).toEqual({ data: [productMock], dados: [productMock] });
  });

  it('POST /perfil/favoritos/:produto_id should add idempotently', async () => {
    const result = await perfilController.add(user, productId);
    expect(service.add).toHaveBeenCalledWith(buyerId, productId);
    expect(result).toEqual({ data: productMock, dados: productMock });
  });

  it('DELETE /perfil/favoritos/:produto_id should remove idempotently', async () => {
    const result = await perfilController.remove(user, productId);
    expect(service.remove).toHaveBeenCalledWith(buyerId, productId);
    expect(result).toEqual({ mensagem: 'Removido dos favoritos', data: null, dados: null });
  });

  it('GET /profile/favorites alias should work', async () => {
    const result = await profileController.findAll(user);
    expect(result).toEqual({ data: [productMock], dados: [productMock] });
  });

  it('POST /profile/favorites/:productId alias should work', async () => {
    const result = await profileController.add(user, productId);
    expect(result).toEqual({ data: productMock, dados: productMock });
  });

  it('DELETE /profile/favorites/:productId alias should work', async () => {
    const result = await profileController.remove(user, productId);
    expect(result.mensagem).toBeDefined();
  });

  it('should have Roles buyer metadata', () => {
    const roles = Reflect.getMetadata('roles', PerfilFavoritosController);
    expect(roles).toEqual(['buyer']);
    const roles2 = Reflect.getMetadata('roles', ProfileFavoritesController);
    expect(roles2).toEqual(['buyer']);
  });

  it('should have correct paths', () => {
    expect(Reflect.getMetadata('path', PerfilFavoritosController)).toBe('perfil/favoritos');
    expect(Reflect.getMetadata('path', ProfileFavoritesController)).toBe('profile/favorites');
  });
});
