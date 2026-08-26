import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@ApiTags('perfil-favoritos')
@ApiBearerAuth('bearer')
@Roles('buyer')
@Controller('perfil/favoritos')
export class PerfilFavoritosController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista produtos favoritos do comprador' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const products = await this.favoritesService.findAll(user.sub);
    return { data: products, dados: products };
  }

  @Post(':produto_id')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Adiciona produto aos favoritos (idempotente)' })
  @ApiParam({ name: 'produto_id', type: 'string', format: 'uuid' })
  async add(
    @CurrentUser() user: JwtPayload,
    @Param('produto_id', ParseUUIDPipe) produtoId: string,
  ) {
    const product = await this.favoritesService.add(user.sub, produtoId);
    return { data: product, dados: product };
  }

  @Delete(':produto_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove produto dos favoritos (idempotente)' })
  @ApiParam({ name: 'produto_id', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('produto_id', ParseUUIDPipe) produtoId: string,
  ) {
    await this.favoritesService.remove(user.sub, produtoId);
    return { mensagem: 'Removido dos favoritos', data: null, dados: null };
  }
}

@ApiTags('profile-favorites')
@ApiBearerAuth('bearer')
@Roles('buyer')
@Controller('profile/favorites')
export class ProfileFavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List buyer favorite products' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const products = await this.favoritesService.findAll(user.sub);
    return { data: products, dados: products };
  }

  @Post(':productId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add product to favorites (idempotent)' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  async add(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    const product = await this.favoritesService.add(user.sub, productId);
    return { data: product, dados: product };
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove product from favorites (idempotent)' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.favoritesService.remove(user.sub, productId);
    return { message: 'Removed from favorites', mensagem: 'Removido dos favoritos', data: null, dados: null };
  }
}
