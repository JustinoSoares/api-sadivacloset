import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Rota exigida pela tarefa: POST /api/v1/webhooks/pagamento/:gateway ───
  @ApiExcludeEndpoint()
  @Public()
  @Post('pagamento/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic payment webhook (public, HMAC, idempotent)',
    description:
      'Validates HMAC signature configurable by env (PAYMENT_WEBHOOK_SECRET or PAYMENT_WEBHOOK_SECRET_<GATEWAY>), uses external reference as idempotent key (Redis + webhook_processed_at column), updates Payment and Order to paid, triggers notifications and enqueues BullMQ queue pagamento-confirmado.',
  })
  @ApiParam({ name: 'gateway', enum: ['appypay', 'ekwanza', 'generic', 'bridpay', 'gpo', 'gpr', 'kwik'], description: 'Gateway name' })
  @ApiResponse({ status: 200, description: 'Success - webhook processed' })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid signature or payload' })
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
  @ApiOperation({ summary: 'Generic payment webhook (alias)', description: 'Alias for generic payment webhook' })
  @ApiParam({ name: 'gateway', enum: ['appypay', 'ekwanza', 'generic', 'bridpay', 'gpo', 'gpr', 'kwik'] })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
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
  @ApiOperation({ summary: 'BridPay webhook - confirms payment (only point that can mark order as paid besides admin validation)', description: 'Handles BridPay webhook' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async bridpayWebhook(@Body() body: any, @Headers('x-signature') signature?: string) {
    const result = await this.paymentsService.handleBridpayWebhook(body);
    return result;
  }

  @ApiExcludeEndpoint()
  @Public()
  @Post('pagamentos/bridpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias for BridPay webhook', description: 'Alias for BridPay webhook' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async bridpayAlias(@Body() body: any) {
    return this.paymentsService.handleBridpayWebhook(body);
  }

  // Webhooks diretos dos providers reais (AppPay e E-Kwanza) – usados quando Sadiva chama provider direto sem BridPay
  @Public()
  @Post('appypay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AppPay webhook (GPO/GPR) - validates x-signature HMAC and confirms payment', description: 'Handles AppPay webhook' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async appypayWebhook(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentsService.handleAppPayWebhook(rawBody, headers);
  }

  @Public()
  @Post('ekwanza')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'E-Kwanza webhook (KWiK/Reference) - validates x-signature and confirms payment', description: 'Handles E-Kwanza webhook' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async ekwanzaWebhook(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : typeof body === 'string' ? body : JSON.stringify(body);
    return this.paymentsService.handleEkwanzaWebhook(rawBody, headers);
  }
}
