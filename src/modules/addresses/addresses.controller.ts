import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/create-address.dto';

@ApiExcludeController()
@ApiTags('perfil-enderecos')
@ApiBearerAuth('bearer')
@Controller('perfil/enderecos')
export class PerfilEnderecosController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista endereços do comprador', description: 'Returns buyer addresses' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const addresses = await this.addressesService.findAll(user.sub);
    return { data: addresses };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria endereço (primeiro fica predefinido automaticamente)',
    description: 'Creates address, first becomes default',
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    const label = dto.labelNormalized;
    const province = dto.provinceNormalized;
    const municipality = dto.municipalityNormalized;
    const neighborhood = dto.neighborhoodNormalized;
    const street = dto.streetNormalized;
    const reference = dto.referenceNormalized ?? null;

    if (!label || !province || !municipality || !neighborhood || !street) {
      const details: { field: string; errors: string[] }[] = [];
      if (!label) details.push({ field: 'label', errors: ['label is required'] });
      if (!province) details.push({ field: 'province', errors: ['province is required'] });
      if (!municipality) details.push({ field: 'municipality', errors: ['municipality is required'] });
      if (!neighborhood) details.push({ field: 'neighborhood', errors: ['neighborhood is required'] });
      if (!street) details.push({ field: 'street', errors: ['street is required'] });
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
      });
    }

    const address = await this.addressesService.create(user.sub, {
      label,
      province,
      municipality,
      neighborhood,
      street,
      reference,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
    return { data: address };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita endereço', description: 'Updates address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const label = dto.labelNormalized;
    const province = dto.provinceNormalized;
    const municipality = dto.municipalityNormalized;
    const neighborhood = dto.neighborhoodNormalized;
    const street = dto.streetNormalized;
    const reference = dto.referenceNormalized;
    const hasAny =
      label !== undefined ||
      province !== undefined ||
      municipality !== undefined ||
      neighborhood !== undefined ||
      street !== undefined ||
      reference !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined;
    if (!hasAny) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update', details: [] },
      });
    }
    const address = await this.addressesService.update(user.sub, id, {
      label,
      province,
      municipality,
      neighborhood,
      street,
      reference: reference !== undefined ? reference : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { data: address };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove endereço (impede se único com pedidos pendentes)',
    description: 'Removes address, prevents if last with pending orders',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.remove(user.sub, id);
    return { message: 'Address removed', data: null };
  }

  @Patch(':id/predefinir')
  @ApiOperation({
    summary: 'Marca endereço como predefinido e desmarca restantes',
    description: 'Sets address as default',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async setDefault(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const address = await this.addressesService.setDefault(user.sub, id);
    return { data: address };
  }
}

@ApiTags('profile-addresses')
@ApiBearerAuth('bearer')
@Controller('profile/addresses')
export class ProfileAddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List buyer addresses', description: 'Returns buyer addresses' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const addresses = await this.addressesService.findAll(user.sub);
    return { data: addresses };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create address (first becomes default)',
    description: 'Creates address, first becomes default',
  })
  @ApiBody({ type: CreateAddressDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    const label = dto.labelNormalized;
    const province = dto.provinceNormalized;
    const municipality = dto.municipalityNormalized;
    const neighborhood = dto.neighborhoodNormalized;
    const street = dto.streetNormalized;
    if (!label || !province || !municipality || !neighborhood || !street) {
      const details: { field: string; errors: string[] }[] = [];
      if (!label) details.push({ field: 'label', errors: ['label is required'] });
      if (!province) details.push({ field: 'province', errors: ['province is required'] });
      if (!municipality) details.push({ field: 'municipality', errors: ['municipality is required'] });
      if (!neighborhood) details.push({ field: 'neighborhood', errors: ['neighborhood is required'] });
      if (!street) details.push({ field: 'street', errors: ['street is required'] });
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
      });
    }
    const address = await this.addressesService.create(user.sub, {
      label: label!,
      province: province!,
      municipality: municipality!,
      neighborhood: neighborhood!,
      street: street!,
      reference: dto.referenceNormalized ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
    });
    return { data: address };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update address', description: 'Updates address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateAddressDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const label = dto.labelNormalized;
    const province = dto.provinceNormalized;
    const municipality = dto.municipalityNormalized;
    const neighborhood = dto.neighborhoodNormalized;
    const street = dto.streetNormalized;
    const reference = dto.referenceNormalized;
    const hasAny =
      label !== undefined ||
      province !== undefined ||
      municipality !== undefined ||
      neighborhood !== undefined ||
      street !== undefined ||
      reference !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined;
    if (!hasAny) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'No fields to update', details: [] },
      });
    }
    const address = await this.addressesService.update(user.sub, id, {
      label,
      province,
      municipality,
      neighborhood,
      street,
      reference: reference !== undefined ? reference : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { data: address };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove address', description: 'Removes address' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.addressesService.remove(user.sub, id);
    return { message: 'Address removed', data: null };
  }

  @Patch(':id/default')
  @ApiOperation({
    summary: 'Set address as default',
    description: 'Sets address as default and unsets others',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async setDefault(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const address = await this.addressesService.setDefault(user.sub, id);
    return { data: address };
  }
}
