import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BridpayGpoResult {
  paymentIntentId: string;
  merchantTxId: string;
  status: string;
  phoneNumber: string;
  expiresAt: string | null;
  timeToPay: number | null;
  providerReference: string;
  paymentUrl: string;
}

export interface BridpayGprResult {
  paymentIntentId: string;
  merchantTxId: string;
  status: string;
  referenceNumber: string;
  entity: string;
  expiresAt: string | null;
  timeToPay: number | null;
  providerReference: string;
}

export interface BridpayKwikResult {
  payoutId: string;
  merchantTxId: string;
  status: string;
  iban: string;
  ekzOperationCode: string;
  ekzTransactionCode: string;
  providerReference: string;
}

@Injectable()
export class BridpayClient {
  private readonly logger = new Logger(BridpayClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly environment: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (this.config.get<string>('bridpay.baseUrl') || 'http://localhost:3000').replace(/\/$/, '');
    this.apiKey = this.config.get<string>('bridpay.apiKey') || '';
    this.environment = this.config.get<string>('bridpay.environment') || 'sandbox';
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      // BridPay uses ApiKeyGuard with x-api-key or Authorization Bearer?
      // Support both: x-api-key and Authorization
      h['x-api-key'] = this.apiKey;
      h['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  private async request<T>(method: string, path: string, body?: any, idempotencyKey?: string): Promise<T | null> {
    if (!this.apiKey) {
      this.logger.warn(`BridPay API key not configured – skipping ${method} ${path} (mock mode)`);
      return null;
    }
    const url = `${this.baseUrl}${path}`;
    const headers = this.headers();
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) {
        this.logger.warn(`BridPay ${method} ${path} failed ${res.status}: ${text}`);
        // Return null to allow fallback to local pending flow
        return null;
      }
      return data as T;
    } catch (e: any) {
      this.logger.warn(`BridPay request error ${method} ${path}: ${e.message}`);
      return null;
    }
  }

  async createGpo(amount: number, phoneNumber: string, description?: string, expiresInSeconds?: number): Promise<BridpayGpoResult | null> {
    return this.request<BridpayGpoResult>('POST', '/v1/payments/gpo', {
      amount,
      phoneNumber,
      description,
      expiresInSeconds,
    });
  }

  async createGpr(amount: number, description?: string): Promise<BridpayGprResult | null> {
    return this.request<BridpayGprResult>('POST', '/v1/payments/gpr', {
      amount,
      description,
    });
  }

  async createKwik(amount: number, iban: string, description?: string): Promise<BridpayKwikResult | null> {
    return this.request<BridpayKwikResult>('POST', '/v1/payments/kwik', {
      amount,
      iban,
      description,
    });
  }

  async getWalletBalance(): Promise<any | null> {
    return this.request('GET', `/v1/wallet/balance?environment=${this.environment}`);
  }

  async getWalletTransactions(params: { page?: number; perPage?: number; type?: string } = {}): Promise<any | null> {
    const qs = new URLSearchParams();
    qs.set('environment', this.environment);
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.type) qs.set('type', params.type);
    return this.request('GET', `/v1/wallet/transactions?${qs.toString()}`);
  }

  async getWalletStatement(from: string, to: string): Promise<any | null> {
    const qs = new URLSearchParams({ environment: this.environment, from, to });
    return this.request('GET', `/v1/wallet/statement?${qs.toString()}`);
  }
}
