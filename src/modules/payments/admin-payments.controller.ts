import { Controller, Param, ParseUUIDPipe, Patch, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiExcludeController()
@ApiTags('admin-payments')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/pagamentos')
export class AdminPagamentosController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Patch(':id/validar')
  @ApiOperation({
    summary: 'Manual payment validation (only here order becomes paid) – creates audit and notifies',
    description: 'Manually validates payment, marks order as paid, creates audit and notifies',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async validar(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.paymentsService.validarAdmin(user.sub, id);
    return {
      data: result,
      message: 'Payment validated, order marked as paid',
    };
  }

  @Get('historico')
  @ApiOperation({
    summary: 'Global payment history (admin)',
    description: 'Returns global payment history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async historicoAdmin(@Query() dto: PaginationDto) {
    return this.paymentsService.historicoAdmin(dto as any);
  }

  @Get('carteira/historico')
  @ApiOperation({
    summary: 'Global wallet history (credits/debits) – admin',
    description: 'Returns global wallet history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async carteiraAdmin(@Query() dto: PaginationDto) {
    return this.paymentsService.walletHistorico(null, dto as any);
  }

}

@ApiTags('admin-payments')
@ApiBearerAuth('bearer')
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentsController extends AdminPagamentosController {}
