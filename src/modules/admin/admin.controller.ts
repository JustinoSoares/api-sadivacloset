import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  @Roles('admin')
  @Get('ping')
  ping() {
    return { dados: { mensagem: 'pong admin' } };
  }

  // Rota sem decorador explícito mas com path /admin — RolesGuard auto-protege
  @Get('auto')
  auto() {
    return { dados: { mensagem: 'auto pong admin' } };
  }
}
