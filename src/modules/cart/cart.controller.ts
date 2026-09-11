import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'List cart items with subtotal (discounted price * quantity)',
    description: 'Returns cart items with subtotal',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart };
  }

  @Post('itens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add item to cart (validates stock)',
    description: 'Adds item to cart validating stock',
  })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    const productId = dto.productIdNormalized;
    const quantity = dto.quantityNormalized;
    if (!productId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'productId', errors: ['Informe um ID de produto válido (UUID)'] }],
        },
      });
    }
    if (quantity === undefined || quantity === null) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'quantity', errors: ['A quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.addItem(user.sub, productId, quantity);
    return { data: item };
  }

  @Patch('itens/:id')
  @ApiOperation({
    summary: 'Update cart item quantity (validates stock)',
    description: 'Updates cart item quantity validating stock',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async updateItem(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const quantity = dto.quantityNormalized;
    if (quantity === undefined || quantity === null) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'quantity', errors: ['A quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.updateItem(user.sub, id, quantity);
    return { data: item };
  }

  @Delete('itens/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove cart item', description: 'Removes item from cart' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async removeItem(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.cartService.removeItem(user.sub, id);
    return { message: 'Item removido do carrinho com sucesso.', data: null };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cart (remove all items)', description: 'Remove todos os itens do carrinho' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@CurrentUser() user: JwtPayload) {
    await this.cartService.clearCart(user.sub);
    return { message: 'Carrinho limpo com sucesso.', data: null };
  }
}

@ApiTags('cart')
@ApiBearerAuth('bearer')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'List cart items with subtotal (discounted price * quantity)',
    description: 'Returns cart items with subtotal',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getCart(@CurrentUser() user: JwtPayload) {
    const cart = await this.cartService.getCart(user.sub);
    return { data: cart };
  }

  @Post('items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add item to cart (validates stock)',
    description: 'Adds item to cart validating stock',
  })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async addItem(@CurrentUser() user: JwtPayload, @Body() dto: AddCartItemDto) {
    const productId = dto.productIdNormalized;
    const quantity = dto.quantityNormalized;
    if (!productId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'productId', errors: ['Informe um ID de produto válido (UUID)'] }],
        },
      });
    }
    if (quantity === undefined || quantity === null) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'quantity', errors: ['A quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.addItem(
      user.sub,
      productId as string,
      quantity as number,
    );
    return { data: item };
  }

  @Patch('items/:id')
  @ApiOperation({
    summary: 'Update cart item quantity (validates stock)',
    description: 'Updates cart item quantity validating stock',
  })
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
    const quantity = dto.quantityNormalized;
    if (quantity === undefined || quantity === null) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos. Verifique os campos e tente novamente.',
          details: [{ field: 'quantity', errors: ['A quantidade deve ser pelo menos 1'] }],
        },
      });
    }
    const item = await this.cartService.updateItem(user.sub, id, quantity as number);
    return { data: item };
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
    return {
      message: 'Item removido do carrinho com sucesso.',
      data: null,
    };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cart (remove all items)', description: 'Remove todos os itens do carrinho de uma só vez' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@CurrentUser() user: JwtPayload) {
    await this.cartService.clearCart(user.sub);
    return { message: 'Carrinho limpo com sucesso.', data: null };
  }
}
