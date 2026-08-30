import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin')
export class AdminController {
  @Get('ping')
  @ApiOperation({ summary: 'Admin ping', description: 'Returns pong for admin health check' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  ping() {
    return { dados: { mensagem: 'pong admin' } };
  }

  // Rota sem decorador explícito mas com path /admin — RolesGuard auto-protege
  @Get('auto')
  @ApiOperation({ summary: 'Admin auto ping', description: 'Returns auto pong for admin' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  auto() {
    return { dados: { mensagem: 'auto pong admin' } };
  }
}
