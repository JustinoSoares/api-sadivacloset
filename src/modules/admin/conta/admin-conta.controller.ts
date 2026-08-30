import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiBody, ApiExcludeController } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/guards/jwt-auth.guard';
import { AdminContaService } from './admin-conta.service';
import { UpdateContaDto } from './dto/update-conta.dto';

@ApiExcludeController()
@ApiTags('admin-conta')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/conta')
export class AdminContaController {
  constructor(private readonly contaService: AdminContaService) {}

  @Get()
  @ApiOperation({ summary: 'Obtém dados da conta do admin autenticado', description: 'Returns admin account' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getConta(@CurrentUser() user: JwtPayload) {
    const conta = await this.contaService.getConta(user.sub);
    return { data: conta, dados: conta };
  }

  @Patch()
  @ApiOperation({ summary: 'Atualiza dados do admin e troca de password (exige password actual)', description: 'Updates admin account' })
  @ApiBody({ type: UpdateContaDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateConta(@CurrentUser() user: JwtPayload, @Body() dto: UpdateContaDto) {
    const conta = await this.contaService.updateConta(user.sub, {
      nome: dto.nomeNormalized,
      email: dto.emailNormalized,
      passwordActual: dto.passwordActualNormalized,
      novaPassword: dto.novaPasswordNormalized,
    });
    return { data: conta, dados: conta };
  }
}

@ApiTags('admin-account')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/account')
export class AdminAccountController extends AdminContaController {}
