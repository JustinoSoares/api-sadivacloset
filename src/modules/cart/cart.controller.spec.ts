import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CarrinhoController, CartController } from './cart.controller';
import { CartService } from './cart.service';

describe('CarrinhoController', () => {
  let carrinhoController: CarrinhoController;
  let cartController: CartController;
  let service: {
    getCart: jest.Mock;
    addItem: jest.Mock;
    updateItem: jest.Mock;
    removeItem: jest.Mock;
  };

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const cartItemId = '33333333-3333-3333-3333-333333333333';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'buyer' } as any;

  const cartMock = {
    itens: [
      {
        id: cartItemId,
        produto_id: productId,
        quantidade: 2,
        preco_com_desconto: 40500,
        subtotal_item: 81000,
      },
    ],
    items: [
      {
        id: cartItemId,
        produto_id: productId,
        quantidade: 2,
        preco_com_desconto: 40500,
        subtotal_item: 81000,
      },
    ],
    subtotal: 81000,
    total_itens: 1,
    totalItens: 1,
  };
  const itemMock = {
    id: cartItemId,
    produto_id: productId,
    quantidade: 2,
    preco_com_desconto: 40500,
    subtotal_item: 81000,
  };

  beforeEach(async () => {
    service = {
      getCart: jest.fn().mockResolvedValue(cartMock),
      addItem: jest.fn().mockResolvedValue(itemMock),
      updateItem: jest.fn().mockResolvedValue(itemMock),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };

    const mod = await Test.createTestingModule({
      controllers: [CarrinhoController, CartController],
      providers: [{ provide: CartService, useValue: service }],
    }).compile();

    carrinhoController = mod.get(CarrinhoController);
    cartController = mod.get(CartController);
  });

  it('GET /carrinho should return {data,dados}', async () => {
    const result = await carrinhoController.getCart(user);
    expect(service.getCart).toHaveBeenCalledWith(buyerId);
    expect(result).toEqual({ data: cartMock, dados: cartMock });
  });

  it('POST /carrinho/itens should handle produto_id and quantidade', async () => {
    const dto: any = {
      produto_id: productId,
      quantidade: 2,
      productIdNormalized: productId,
      quantityNormalized: 2,
    };
    // need to mimic getter
    Object.defineProperty(dto, 'productIdNormalized', { get: () => productId });
    Object.defineProperty(dto, 'quantityNormalized', { get: () => 2 });
    const result = await carrinhoController.addItem(user, dto);
    expect(service.addItem).toHaveBeenCalledWith(buyerId, productId, 2);
    expect(result).toEqual({ data: itemMock, dados: itemMock });
  });

  it('POST should throw validation if produto_id missing', async () => {
    const dto: any = { quantidade: 2 };
    Object.defineProperty(dto, 'productIdNormalized', { get: () => undefined });
    Object.defineProperty(dto, 'quantityNormalized', { get: () => 2 });
    await expect(carrinhoController.addItem(user, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST should accept English aliases product_id/quantity', async () => {
    const dto: any = { product_id: productId, quantity: 3 };
    Object.defineProperty(dto, 'productIdNormalized', { get: () => productId });
    Object.defineProperty(dto, 'quantityNormalized', { get: () => 3 });
    await carrinhoController.addItem(user, dto);
    expect(service.addItem).toHaveBeenCalledWith(buyerId, productId, 3);
  });

  it('PATCH /carrinho/itens/:id should update', async () => {
    const dto: any = { quantidade: 5 };
    Object.defineProperty(dto, 'quantityNormalized', { get: () => 5 });
    const result = await carrinhoController.updateItem(user, cartItemId, dto);
    expect(service.updateItem).toHaveBeenCalledWith(buyerId, cartItemId, 5);
    expect(result).toEqual({ data: itemMock, dados: itemMock });
  });

  it('PATCH should throw if quantidade missing', async () => {
    const dto: any = {};
    Object.defineProperty(dto, 'quantityNormalized', { get: () => undefined });
    await expect(carrinhoController.updateItem(user, cartItemId, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('DELETE /carrinho/itens/:id should remove', async () => {
    const result = await carrinhoController.removeItem(user, cartItemId);
    expect(service.removeItem).toHaveBeenCalledWith(buyerId, cartItemId);
    expect(result).toEqual({ mensagem: 'Item removido do carrinho', data: null, dados: null });
  });

  it('aliases /cart should mirror behavior', async () => {
    await cartController.getCart(user);
    expect(service.getCart).toHaveBeenCalledWith(buyerId);
    const dto: any = { product_id: productId, quantity: 1 };
    Object.defineProperty(dto, 'productIdNormalized', { get: () => productId });
    Object.defineProperty(dto, 'quantityNormalized', { get: () => 1 });
    await cartController.addItem(user, dto);
    expect(service.addItem).toHaveBeenCalled();
  });

  it('should have correct paths', () => {
    expect(Reflect.getMetadata('path', CarrinhoController)).toBe('carrinho');
    expect(Reflect.getMetadata('path', CartController)).toBe('cart');
  });
});
