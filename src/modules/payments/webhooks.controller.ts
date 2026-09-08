import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiExcludeEndpoint()
  @Public()
  @Post('pagamento/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic payment webhook (public, HMAC, idempotent)',
    description:
      'Validates HMAC signature configurable by env (PAYMENT_WEBHOOK_SECRET or PAYMENT_WEBHOOK_SECRET_<GATEWAY>), uses external reference as idempotent key (Redis + webhookProcessedAt column), updates Payment and Order to paid, triggers notifications and enqueues BullMQ queue payment-confirmed.',
  })
  @ApiParam({
    name: 'gateway',
    enum: ['generic', 'ekwanza', 'kwik', 'appypay', 'bridpay', 'gpo', 'gpr'],
    description: 'Gateway name',
  })
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

  @Public()
  @Post('payment/generic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic payment webhook - canonical (Honor proxy target)',
    description:
      'Canonical generic webhook POST /webhooks/payment/generic (also matches POST /webhooks/payment/:gateway with gateway=generic). Validates HMAC x-signature = HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET) or PAYMENT_WEBHOOK_SECRET_GENERIC, idempotent by externalReference (Redis + webhookProcessedAt), updates Payment/Order to PAID.',
  })
  @ApiResponse({ status: 200, description: 'Success - webhook processed' })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid signature or payload' })
  async paymentGenericWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handlePagamentoWebhook('generic', rawBody, headers, body);
  }

  @Public()
  @Post('payment/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic payment webhook (alias)',
    description: 'Alias for generic payment webhook - accepts any gateway param (generic|ekwanza|kwik|appypay|bridpay|gpo|gpr)',
  })
  @ApiParam({
    name: 'gateway',
    enum: ['generic', 'ekwanza', 'kwik', 'appypay', 'bridpay', 'gpo', 'gpr'],
  })
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
  @Post('ekwanza')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'E-Kwanza webhook (KWiK/Reference) - validates x-signature and confirms payment',
    description: 'Handles E-Kwanza webhook',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async ekwanzaWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const rawBody: string = req.rawBody
      ? req.rawBody.toString('utf8')
      : typeof body === 'string'
        ? body
        : JSON.stringify(body);
    return this.paymentsService.handleEkwanzaWebhook(rawBody, headers);
  }

  @Public()
  @Post('appypay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AppyPay webhook (GPO - Multicaixa Express / GPR - Referência)',
    description:
      'Recebe callback da AppyPay. Payload: { merchantTransactionId, ekwanzaTransactionId, operationStatus: 1|3|4|5, operationData: { amount, merchantIdentifier, referenceType: GPO|REF } }. operationStatus 1=sucesso → marca Payment/Order como PAID.',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async appypayWebhook(@Headers() headers: Record<string, string>, @Req() req: any, @Body() body: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handleAppyPayWebhook(rawBody, headers);
  }

  // Alias para gateway genérico também aceitar appypay via /webhooks/payment/:gateway
  @Public()
  @Post('payment/appypay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AppyPay webhook alias (payment/appypay)', description: 'Alias para POST /webhooks/appypay' })
  @ApiResponse({ status: 200, description: 'Success' })
  async appypayAlias(@Headers() headers: Record<string, string>, @Req() req: any, @Body() body: any) {
    const rawBody: string = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.paymentsService.handleAppyPayWebhook(rawBody, headers);
  }
}
