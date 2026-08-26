import { Module } from '@nestjs/common';
import { PerfilFavoritosController, ProfileFavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
  controllers: [PerfilFavoritosController, ProfileFavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}

export const FavoritosModule = FavoritesModule;
