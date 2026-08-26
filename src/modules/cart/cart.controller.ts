import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';

@ApiTags('carrinho')
@ApiBearerAuth('bearer')
@Controller('carrinho')
export class CarrinhoController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lista itens do carrinho com subtotal (preço com desconto * quantidade)' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart, dados: cart };
  }

  @Post('itens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adiciona item ao carrinho (valida stock)' })
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    const productId = dto.productIdNormalized;
    const quantidade = dto.quantityNormalized;
    if (!productId) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'produto_id', erros: ['produto_id deve ser um UUID válido'] }],
        },
      });
    }
    if (quantidade === undefined || quantidade === null) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'quantidade', erros: ['quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.addItem(user.sub, productId, quantidade);
    return { data: item, dados: item };
  }

  @Patch('itens/:id')
  @ApiOperation({ summary: 'Actualiza quantidade do item (valida stock)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const quantidade = dto.quantityNormalized;
    if (quantidade === undefined || quantidade === null) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'quantidade', erros: ['quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.updateItem(user.sub, id, quantidade);
    return { data: item, dados: item };
  }

  @Delete('itens/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item do carrinho' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removeItem(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.cartService.removeItem(user.sub, id);
    return { mensagem: 'Item removido do carrinho', data: null, dados: null };
  }
}

@ApiTags('cart')
@ApiBearerAuth('bearer')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'List cart items with subtotal (discounted price * quantity)' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart, dados: cart };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart (validates stock)' })
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    const productId = dto.productIdNormalized;
    const quantidade = dto.quantityNormalized;
    if (!productId) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'product_id', erros: ['product_id deve ser um UUID válido'] }],
        },
      });
    }
    if (quantidade === undefined || quantidade === null) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'quantity', erros: ['quantity deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.addItem(user.sub, productId as string, quantidade as number);
    return { data: item, dados: item };
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update cart item quantity (validates stock)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const quantidade = dto.quantityNormalized;
    if (quantidade === undefined || quantidade === null) {
      throw new BadRequestException({
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'quantity', erros: ['quantity deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.updateItem(user.sub, id, quantidade as number);
    return { data: item, dados: item };
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove cart item' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removeItem(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.cartService.removeItem(user.sub, id);
    return { message: 'Cart item removed', mensagem: 'Item removido do carrinho', data: null, dados: null };
  }
}
