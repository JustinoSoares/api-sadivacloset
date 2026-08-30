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
import { AdminLojaService } from './admin-loja.service';
import { UpdateLojaDto } from './dto/update-loja.dto';

@ApiExcludeController()
@ApiTags('admin-loja')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/loja')
export class AdminLojaController {
  constructor(private readonly lojaService: AdminLojaService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtém configuração da loja (LojaConfig)',
    description: 'Returns store configuration',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getLoja() {
    const loja = await this.lojaService.getLoja();
    return { data: loja, dados: loja };
  }

  @Patch()
  @ApiOperation({
    summary: 'Atualiza configuração da loja',
    description: 'Updates store configuration',
  })
  @ApiBody({ type: UpdateLojaDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateLoja(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLojaDto) {
    const loja = await this.lojaService.updateLoja(
      {
        nome: dto.nomeNormalized,
        email: dto.emailNormalized,
        telefone: dto.telefoneNormalized,
        morada: dto.moradaNormalized,
      },
      user.sub,
    );
    return { data: loja, dados: loja };
  }
}

@ApiTags('admin-store')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/store')
export class AdminStoreController extends AdminLojaController {}
