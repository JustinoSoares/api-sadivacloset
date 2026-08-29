import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('pedidos-pagamento')
@ApiBearerAuth('bearer')
@Controller('pedidos/:id/pagamento')
export class PagamentosController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('iniciar')
  @ApiOperation({ summary: 'Inicia pagamento (cria registo PENDENTE/PROCESSANDO). Para GPO/GPR chama BridPay (/gpo,/gpr); para KWIK cria saída' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
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
    return { data: result, dados: result };
  }

  @Get()
  @ApiOperation({ summary: 'Estado actual do pagamento do pedido' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.paymentsService.get(user.sub, id);
    return { data: result, dados: result };
  }

  @Post('comprovativo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload comprovativo (transferência bancária) – muda para PROCESSANDO, aguarda validação admin' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async comprovativo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.paymentsService.comprovativo(user.sub, id, file);
    return { data: result, dados: result, mensagem: 'Comprovativo enviado, aguarda validação' };
  }
}

// Aliases ingleses

@ApiTags('orders-payment')
@ApiBearerAuth('bearer')
@Controller('orders/:id/payment')
export class OrdersPaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('init')
  @ApiOperation({ summary: 'Initiate payment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
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
    return { data: result, dados: result };
  }

  @Get()
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.paymentsService.get(user.sub, id);
    return { data: result, dados: result };
  }

  @Post('receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload receipt' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async comprovativo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.paymentsService.comprovativo(user.sub, id, file);
    return { data: result, dados: result };
  }
}

@ApiTags('pagamentos-historico')
@ApiBearerAuth('bearer')
@Controller('pagamentos')
export class PagamentosHistoricoController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('historico')
  @ApiOperation({ summary: 'Histórico de pagamentos do comprador (entradas)' })
  async historico(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    return this.paymentsService.historico(user.sub, dto);
  }

  @Get('entradas')
  @ApiOperation({ summary: 'Entradas (créditos)' })
  async entradas(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    (dto as any).tipo = 'entrada';
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }

  @Get('saidas')
  @ApiOperation({ summary: 'Saídas (débitos via KWIK)' })
  async saidas(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    (dto as any).tipo = 'saida';
    return this.paymentsService.walletHistorico(user.sub, dto as any);
  }

  @Get('carteira/historico')
  @ApiOperation({ summary: 'Histórico completo da carteira (entradas e saídas)' })
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
  @ApiOperation({ summary: 'Wallet historico (proxy BridPay + local)' })
  async historico(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDto) {
    const local = await this.paymentsService.walletHistorico(user.sub, dto as any);
    const bridpay = await this.paymentsService.bridpayWalletProxy();
    return { local, bridpay, data: local.data, dados: local.dados };
  }
}
