import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminStoreService } from './admin-store.service';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('admin-store')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/store')
export class AdminStoreController {
  constructor(private readonly storeService: AdminStoreService) {}

  @Get()
  @ApiOperation({
    summary: 'Get store configuration (StoreConfig)',
    description: 'Returns store configuration',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async getStore() {
    const store = await this.storeService.getStore();
    return { data: store };
  }

  // legacy alias
  async getLoja() {
    return this.getStore();
  }

  @Patch()
  @ApiOperation({
    summary: 'Update store configuration',
    description: 'Updates store configuration',
  })
  @ApiBody({ type: UpdateStoreDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async updateStore(@CurrentUser() user: JwtPayload, @Body() dto: UpdateStoreDto) {
    const store = await this.storeService.updateStore(
      {
        name: (dto as any).nameNormalized ?? (dto as any).nomeNormalized,
        email: (dto as any).emailNormalized,
        phone: (dto as any).phoneNormalized ?? (dto as any).telefoneNormalized,
        address: (dto as any).addressNormalized ?? (dto as any).moradaNormalized,
      },
      user.sub,
    );
    return { data: store };
  }

  async updateLoja(user: JwtPayload, dto: UpdateStoreDto) {
    return this.updateStore(user, dto);
  }
}

@ApiExcludeController()
@ApiTags('admin-loja')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/loja')
export class AdminLojaController extends AdminStoreController {}
