import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiConsumes,
  ApiResponse,
  ApiBody,
  ApiExcludeController,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiExcludeController()
@ApiTags('orders-payment')
@ApiBearerAuth('bearer')
@Controller('pedidos/:id/pagamento')
export class PagamentosController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('iniciar')
  @ApiOperation({
    summary: 'Initiate payment (creates PENDING/PROCESSING record). For KWIK via E-Kwanza creates payout',
    description: 'Initiates payment creating PENDING/PROCESSING record',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: IniciarPagamentoDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async iniciar(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarPagamentoDto,
  ) {
    const metodo = dto.metodoNormalized;
    const result = await this.paymentsService.iniciar(user.sub, id, {
      metodo,
      phoneNumber: dto.phoneNormalized,
      iban: dto.ibanNormalized,
      descricao: dto.descricaoNormalized,
      expiresInSeconds: dto.expiresInSeconds,
    });
    return { data: result };
  }

  @Get()
  @ApiOperation({
    summary: 'Get current payment status for order',
    description: 'Returns current payment status for order',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.paymentsService.get(user.sub, id);
    return { data: result };
  }

  @Post('comprovativo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload receipt (bank transfer) – sets to PROCESSING, awaits admin validation',
    description: 'Uploads receipt, sets to PROCESSING awaiting admin validation',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async comprovativo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.paymentsService.comprovativo(user.sub, id, file);
    return { data: result, message: 'Receipt uploaded, awaiting validation' };
  }
}

// Aliases ingleses

@ApiTags('orders-payment')
@ApiBearerAuth('bearer')
@Controller('orders/:id/payment')
export class OrdersPaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('init')
  @ApiOperation({ summary: 'Initiate payment', description: 'Initiates payment for order' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: IniciarPagamentoDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async iniciar(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarPagamentoDto,
  ) {
    const metodo = dto.metodoNormalized;
    const result = await this.paymentsService.iniciar(user.sub, id, {
      metodo,
      phoneNumber: dto.phoneNormalized,
      iban: dto.ibanNormalized,
      descricao: dto.descricaoNormalized,
      expiresInSeconds: dto.expiresInSeconds,
    });
    return { data: result };
  }

  @Get()
  @ApiOperation({ summary: 'Get payment status', description: 'Returns payment status for order' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.paymentsService.get(user.sub, id);
    return { data: result };
  }

  @Post('receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload receipt', description: 'Uploads receipt for bank transfer' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async comprovativo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.paymentsService.comprovativo(user.sub, id, file);
    return { data: result };
  }
}

@ApiExcludeController()
@ApiTags('payments-history')
@ApiBearerAuth('bearer')
@Controller('pagamentos')
export class PagamentosHistoricoController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('historico')
  @ApiOperation({
    summary: 'Buyer payment history',
    description: 'Returns buyer payment history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async historico(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    return this.paymentsService.historico(user.sub, dto);
  }

  @Get('entradas')
  @ApiOperation({ summary: 'Credits (inbound)', description: 'Returns credits' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async entradas(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    (dto as any).type = 'credit';
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }

  @Get('saidas')
  @ApiOperation({ summary: 'Debits (outbound via KWIK)', description: 'Returns debits' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async saidas(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    (dto as any).type = 'debit';
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }

  @Get('carteira/historico')
  @ApiOperation({
    summary: 'Complete wallet history (credits and debits)',
    description: 'Returns complete wallet history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async carteira(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }
}

@ApiTags('wallet')
@ApiBearerAuth('bearer')
@Controller('wallet')
export class WalletController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('historico')
  @ApiOperation({
    summary: 'Wallet history (local)',
    description: 'Returns local wallet history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async historico(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    const local = await this.paymentsService.walletHistorico(user.sub, dto as any);
    return { data: local.data, meta: (local as any).meta, page: (local as any).page, total: (local as any).total, totalPages: (local as any).totalPages };
  }

  @Get('history')
  @ApiOperation({
    summary: 'Wallet history (local) - English alias',
    description: 'Returns local wallet history',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async history(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }
}
