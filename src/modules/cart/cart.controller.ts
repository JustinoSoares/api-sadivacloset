import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiResponse, ApiBody, ApiExcludeController } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';

@ApiExcludeController()
@ApiTags('carrinho')
@ApiBearerAuth('bearer')
@Controller('carrinho')
export class CarrinhoController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Lista itens do carrinho com subtotal (preço com desconto * quantidade)', description: 'Returns cart items with subtotal' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart, dados: cart };
  }

  @Post('itens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adiciona item ao carrinho (valida stock)', description: 'Adds item to cart validating stock' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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
  @ApiOperation({ summary: 'Actualiza quantidade do item (valida stock)', description: 'Updates cart item quantity validating stock' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Not Found' })
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
  @ApiOperation({ summary: 'Remove item do carrinho', description: 'Removes item from cart' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Not Found' })
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
  @ApiOperation({ summary: 'List cart items with subtotal (discounted price * quantity)', description: 'Returns cart items with subtotal' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart, dados: cart };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add item to cart (validates stock)', description: 'Adds item to cart validating stock' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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
  @ApiOperation({ summary: 'Update cart item quantity (validates stock)', description: 'Updates cart item quantity validating stock' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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
  @ApiOperation({ summary: 'Remove cart item', description: 'Removes item from cart' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async removeItem(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.cartService.removeItem(user.sub, id);
    return { message: 'Cart item removed', mensagem: 'Item removido do carrinho', data: null, dados: null };
  }
}
