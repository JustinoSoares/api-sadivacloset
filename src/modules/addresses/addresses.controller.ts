import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';

@ApiTags('perfil-enderecos')
@ApiBearerAuth('bearer')
@Controller('perfil/enderecos')
export class PerfilEnderecosController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista endereços do comprador' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const addresses = await this.addressesService.findAll(user.sub);
    return { data: addresses, dados: addresses };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria endereço (primeiro fica predefinido automaticamente)' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    const etiqueta = dto.labelNormalized;
    const provincia = dto.provinceNormalized;
    const municipio = dto.municipalityNormalized;
    const bairro = dto.neighborhoodNormalized;
    const rua = dto.streetNormalized;
    const referencia = dto.referenceNormalized ?? null;

    if (!etiqueta || !provincia || !municipio || !bairro || !rua) {
      const detalhes: { campo: string; erros: string[] }[] = [];
      if (!etiqueta) detalhes.push({ campo: 'etiqueta', erros: ['etiqueta não pode ser vazia'] });
      if (!provincia) detalhes.push({ campo: 'provincia', erros: ['provincia não pode ser vazia'] });
      if (!municipio) detalhes.push({ campo: 'municipio', erros: ['municipio não pode ser vazio'] });
      if (!bairro) detalhes.push({ campo: 'bairro', erros: ['bairro não pode ser vazio'] });
      if (!rua) detalhes.push({ campo: 'rua', erros: ['rua não pode ser vazia'] });
      throw new BadRequestException({
        erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'Erro de validação', detalhes },
      });
    }

    const address = await this.addressesService.create(user.sub, {
      etiqueta,
      provincia,
      municipio,
      bairro,
      rua,
      referencia,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
    return { data: address, dados: address };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita endereço' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAddressDto) {
    const address = await this.addressesService.update(user.sub, id, {
      etiqueta: dto.labelNormalized,
      provincia: dto.provinceNormalized,
      municipio: dto.municipalityNormalized,
      bairro: dto.neighborhoodNormalized,
      rua: dto.streetNormalized,
      referencia: dto.referenceNormalized !== undefined ? dto.referenceNormalized : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { data: address, dados: address };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove endereço (impede se único com pedidos pendentes)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.remove(user.sub, id);
    return { mensagem: 'Endereço removido', data: null, dados: null };
  }

  @Patch(':id/predefinir')
  @ApiOperation({ summary: 'Marca endereço como predefinido e desmarca restantes' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async setDefault(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const address = await this.addressesService.setDefault(user.sub, id);
    return { data: address, dados: address };
  }
}

@ApiTags('profile-addresses')
@ApiBearerAuth('bearer')
@Controller('profile/addresses')
export class ProfileAddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List buyer addresses' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const addresses = await this.addressesService.findAll(user.sub);
    return { data: addresses, dados: addresses };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create address (first becomes default)' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    const etiqueta = dto.labelNormalized;
    const provincia = dto.provinceNormalized;
    const municipio = dto.municipalityNormalized;
    const bairro = dto.neighborhoodNormalized;
    const rua = dto.streetNormalized;
    if (!etiqueta || !provincia || !municipio || !bairro || !rua) {
      const detalhes: { campo: string; erros: string[] }[] = [];
      if (!etiqueta) detalhes.push({ campo: 'label', erros: ['label is required'] });
      if (!provincia) detalhes.push({ campo: 'province', erros: ['province is required'] });
      if (!municipio) detalhes.push({ campo: 'municipality', erros: ['municipality is required'] });
      if (!bairro) detalhes.push({ campo: 'neighborhood', erros: ['neighborhood is required'] });
      if (!rua) detalhes.push({ campo: 'street', erros: ['street is required'] });
      throw new BadRequestException({
        erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'Erro de validação', detalhes },
      });
    }
    const address = await this.addressesService.create(user.sub, {
      etiqueta: etiqueta!,
      provincia: provincia!,
      municipio: municipio!,
      bairro: bairro!,
      rua: rua!,
      referencia: dto.referenceNormalized ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
    return { data: address, dados: address };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAddressDto) {
    const address = await this.addressesService.update(user.sub, id, {
      etiqueta: dto.labelNormalized,
      provincia: dto.provinceNormalized,
      municipio: dto.municipalityNormalized,
      bairro: dto.neighborhoodNormalized,
      rua: dto.streetNormalized,
      referencia: dto.referenceNormalized !== undefined ? dto.referenceNormalized : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { data: address, dados: address };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.remove(user.sub, id);
    return { message: 'Address removed', mensagem: 'Endereço removido', data: null, dados: null };
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set address as default' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async setDefault(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const address = await this.addressesService.setDefault(user.sub, id);
    return { data: address, dados: address };
  }
}
