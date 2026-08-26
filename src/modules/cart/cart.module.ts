import { Module } from '@nestjs/common';
import { CarrinhoController, CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  controllers: [CarrinhoController, CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}

export const CarrinhoModule = CartModule;
