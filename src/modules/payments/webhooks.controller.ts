import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Rota exigida pela tarefa: POST /api/v1/webhooks/pagamento/:gateway ───
  @Public()
  @Post('pagamento/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook genérico de pagamento (público, HMAC, idempotente). Ao confirmar: Pagamento=pago, Pedido=pago, notifica e enfileira BullMQ',
    description:
      'Valida assinatura HMAC configurável por env (PAYMENT_WEBHOOK_SECRET ou PAYMENT_WEBHOOK_SECRET_<GATEWAY>), usa referencia_externa como chave idempotente (Redis + coluna webhook_processado_em), atualiza Pagamento e Pedido para pago, dispara NotificacoesService e enfileira fila BullMQ dedicada pagamento-confirmado.',
  })
  @ApiParam({ name: 'gateway', enum: ['appypay', 'ekwanza', 'generic', 'bridpay', 'gpo', 'gpr', 'kwik'], description: 'Nome do gateway' })
  async pagamentoWebhook(
    @Param('gateway') gateway: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handlePagamentoWebhook(gateway, rawBody, headers, body);
  }

  // Alias inglês
  @Public()
  @Post('payment/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generic payment webhook (alias)' })
  async paymentWebhookAlias(
    @Param('gateway') gateway: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handlePagamentoWebhook(gateway, rawBody, headers, body);
  }

  @Public()
  @Post('bridpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook BridPay – confirma pagamento (único ponto que pode marcar pedido como pago, além de validação admin)' })
  async bridpayWebhook(@Body() body: any, @Headers('x-signature') signature?: string) {
    const result = await this.paymentsService.handleBridpayWebhook(body);
    return result;
  }

  @Public()
  @Post('pagamentos/bridpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias para webhook BridPay' })
  async bridpayAlias(@Body() body: any) {
    return this.paymentsService.handleBridpayWebhook(body);
  }

  // Webhooks diretos dos providers reais (AppPay e E-Kwanza) – usados quando Sadiva chama provider direto sem BridPay
  @Public()
  @Post('appypay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook AppPay (GPO/GPR) – valida x-signature HMAC e confirma pagamento' })
  async appypayWebhook(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentsService.handleAppPayWebhook(rawBody, headers);
  }

  @Public()
  @Post('ekwanza')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook E-Kwanza (KWiK/Reference) – valida x-signature e confirma pagamento' })
  async ekwanzaWebhook(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentsService.handleEkwanzaWebhook(rawBody, headers);
  }
}
