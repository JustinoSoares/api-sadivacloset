import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppyPayTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  resource?: string;
}

export interface AppyPayChargeRequest {
  amount: number;
  currency?: string; // default AOA
  description?: string;
  merchantTransactionId: string;
  paymentMethod: string;
  paymentInfo?: { phoneNumber: string };
  options: {
    MerchantIdentifier: string;
    ApiKey: string;
  };
}

export interface AppyPayChargeResponse {
  id?: string;
  merchantTransactionId?: string;
  status?: string | number;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  // Campos típicos para referência
  reference?: string;
  entity?: string;
  expirationDate?: string;
  // Para GPO
  transactionId?: string;
  providerTransactionId?: string;
  // Raw
  [key: string]: any;
}

@Injectable()
export class AppyPayClient {
  private readonly logger = new Logger(AppyPayClient.name);
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const cid = this.config.get<string>('appypay.clientId') ?? this.config.get<string>('APPYPAY_CLIENT_ID');
    const secret = this.config.get<string>('appypay.clientSecret') ?? this.config.get<string>('APPYPAY_CLIENT_SECRET');
    const resource = this.config.get<string>('appypay.resource') ?? this.config.get<string>('APPYPAY_RESOURCE');
    const authUrl = this.config.get<string>('appypay.authUrl') ?? this.config.get<string>('APPYPAY_AUTH_URL');
    const apiBase = this.config.get<string>('appypay.apiBaseUrl') ?? this.config.get<string>('APPYPAY_API_BASE_URL');
    return !!(cid && secret && resource && authUrl && apiBase);
  }

  private getTimeout(): number {
    const raw = this.config.get<string>('appypay.httpTimeoutMs') ?? this.config.get<string>('APPYPAY_HTTP_TIMEOUT_MS') ?? '60000';
    const n = parseInt(String(raw), 10);
    return Math.min(Math.max(isNaN(n) ? 60000 : n, 5000), 120000);
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiry - 60000) {
      return this.cachedToken;
    }

    const authUrl =
      this.config.get<string>('appypay.authUrl') ?? this.config.get<string>('APPYPAY_AUTH_URL') ?? '';
    const tenant = this.config.get<string>('appypay.tenant') ?? this.config.get<string>('APPYPAY_TENANT') ?? '';
    const clientId = this.config.get<string>('appypay.clientId') ?? this.config.get<string>('APPYPAY_CLIENT_ID') ?? '';
    const clientSecret = this.config.get<string>('appypay.clientSecret') ?? this.config.get<string>('APPYPAY_CLIENT_SECRET') ?? '';
    const resource = this.config.get<string>('appypay.resource') ?? this.config.get<string>('APPYPAY_RESOURCE') ?? '';

    if (!authUrl || !clientId || !clientSecret || !resource) {
      throw new Error('AppyPay não configurado: faltam APPYPAY_AUTH_URL/CLIENT_ID/CLIENT_SECRET/RESOURCE');
    }

    // Se authUrl já contém oauth2/token, usa direto; senão tenta construir com tenant
    let tokenUrl = authUrl;
    if (!tokenUrl.includes('/oauth2/token') && tenant) {
      // Fallback: https://login.microsoftonline.com/{tenant}/oauth2/token
      tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/token`;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      resource,
    });

    this.logger.log(`AppyPay autenticando em ${tokenUrl}`);

    const timeoutMs = this.getTimeout();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text();
        this.logger.error(`AppyPay auth falhou ${res.status}: ${txt}`);
        throw new Error(`AppyPay auth failed ${res.status}: ${txt}`);
      }

      const data = (await res.json()) as AppyPayTokenResponse;
      if (!data.access_token) {
        throw new Error('AppyPay auth: access_token ausente');
      }

      this.cachedToken = data.access_token;
      const expiresIn = data.expires_in ? parseInt(String(data.expires_in), 10) : 3600;
      this.tokenExpiry = now + expiresIn * 1000;
      this.logger.log(`AppyPay token obtido (expira em ${expiresIn}s)`);
      return data.access_token;
    } finally {
      clearTimeout(timer);
    }
  }

  async createCharge(request: AppyPayChargeRequest): Promise<AppyPayChargeResponse> {
    const token = await this.getAccessToken();
    const apiBase =
      this.config.get<string>('appypay.apiBaseUrl') ?? this.config.get<string>('APPYPAY_API_BASE_URL') ?? '';
    if (!apiBase) throw new Error('APPYPAY_API_BASE_URL não configurado');

    const base = apiBase.replace(/\/$/, '');
    const url = `${base}/v2.0/charges`;

    const payload: any = {
      amount: request.amount,
      currency: request.currency ?? 'AOA',
      description: request.description ?? `Pedido ${request.merchantTransactionId}`,
      merchantTransactionId: request.merchantTransactionId,
      paymentMethod: request.paymentMethod,
      options: request.options,
    };

    if (request.paymentInfo?.phoneNumber) {
      payload.paymentInfo = { phoneNumber: request.paymentInfo.phoneNumber };
    }

    const timeoutMs = this.getTimeout();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.log(`AppyPay POST ${url} amount=${request.amount} method=${request.paymentMethod} mTxId=${request.merchantTransactionId}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const txt = await res.text();
      let json: any;
      try {
        json = txt ? JSON.parse(txt) : {};
      } catch {
        json = { raw: txt };
      }

      if (!res.ok) {
        this.logger.warn(`AppyPay charge falhou ${res.status}: ${txt}`);
        throw new Error(`AppyPay charge failed ${res.status}: ${txt}`);
      }

      this.logger.log(`AppyPay charge sucesso: ${txt.substring(0, 500)}`);
      return json as AppyPayChargeResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Cria cobrança GPO (Multicaixa Express) – requer phoneNumber
   */
  async createGpoCharge(params: { amount: number; merchantTransactionId: string; phoneNumber: string; description?: string }): Promise<AppyPayChargeResponse> {
    const paymentMethod = this.config.get<string>('appypay.paymentMethodGpo') ?? this.config.get<string>('APPYPAY_PAYMENT_METHOD_GPO') ?? '';
    const merchantIdentifier = this.config.get<string>('appypay.merchantIdentifier') ?? this.config.get<string>('APPYPAY_MERCHANT_IDENTIFIER') ?? '';
    const apiKey = this.config.get<string>('appypay.optionsApiKey') ?? this.config.get<string>('APPYPAY_OPTIONS_API_KEY') ?? '';

    if (!paymentMethod) throw new Error('APPYPAY_PAYMENT_METHOD_GPO não configurado');
    if (!merchantIdentifier || !apiKey) throw new Error('APPYPAY_MERCHANT_IDENTIFIER / APPYPAY_OPTIONS_API_KEY não configurados');

    return this.createCharge({
      amount: params.amount,
      currency: 'AOA',
      description: params.description,
      merchantTransactionId: params.merchantTransactionId,
      paymentMethod,
      paymentInfo: { phoneNumber: params.phoneNumber },
      options: { MerchantIdentifier: merchantIdentifier, ApiKey: apiKey },
    });
  }

  /**
   * Cria cobrança GPR (Referência Multicaixa)
   */
  async createReferenceCharge(params: { amount: number; merchantTransactionId: string; description?: string }): Promise<AppyPayChargeResponse> {
    const paymentMethod = this.config.get<string>('appypay.paymentMethodReference') ?? this.config.get<string>('APPYPAY_PAYMENT_METHOD_REFERENCE') ?? '';
    const merchantIdentifier = this.config.get<string>('appypay.merchantIdentifier') ?? this.config.get<string>('APPYPAY_MERCHANT_IDENTIFIER') ?? '';
    const apiKey = this.config.get<string>('appypay.optionsApiKey') ?? this.config.get<string>('APPYPAY_OPTIONS_API_KEY') ?? '';

    if (!paymentMethod) throw new Error('APPYPAY_PAYMENT_METHOD_REFERENCE não configurado');
    if (!merchantIdentifier || !apiKey) throw new Error('APPYPAY_MERCHANT_IDENTIFIER / APPYPAY_OPTIONS_API_KEY não configurados');

    return this.createCharge({
      amount: params.amount,
      currency: 'AOA',
      description: params.description,
      merchantTransactionId: params.merchantTransactionId,
      paymentMethod,
      options: { MerchantIdentifier: merchantIdentifier, ApiKey: apiKey },
    });
  }

  clearTokenCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }
}
