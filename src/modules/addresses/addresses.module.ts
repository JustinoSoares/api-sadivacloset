import { Module } from '@nestjs/common';
import { PerfilEnderecosController, ProfileAddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

@Module({
  controllers: [PerfilEnderecosController, ProfileAddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}

export const EnderecosModule = AddressesModule;
