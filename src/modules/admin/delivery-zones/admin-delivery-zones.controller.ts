import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminDeliveryZonesService } from './admin-delivery-zones.service';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/create-delivery-zone.dto';

@ApiTags('admin-delivery-zones')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/delivery-zones')
export class AdminDeliveryZonesController {
  constructor(private readonly service: AdminDeliveryZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List delivery zones (admin)', description: 'Returns all delivery zones ordered by neighborhood' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get delivery zone by id (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const zone = await this.service.findOne(id);
    return { data: zone };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create delivery zone (admin)', description: 'Creates bairro with price. Neighborhood must be unique.' })
  @ApiBody({ type: CreateDeliveryZoneDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request - duplicate neighborhood' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDeliveryZoneDto) {
    const zone = await this.service.create(dto, user.sub);
    return { data: zone };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update delivery zone (admin)', description: 'Updates neighborhood and/or price' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateDeliveryZoneDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async update(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeliveryZoneDto) {
    const zone = await this.service.update(id, dto, user.sub);
    return { data: zone };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete delivery zone (admin)', description: 'Removes zone by id' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, user.sub);
  }
}

@ApiExcludeController()
@ApiTags('admin-zonas-entrega')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/zonas-entrega')
export class AdminZonasEntregaController extends AdminDeliveryZonesController {}
