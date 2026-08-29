import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppPayChargeRequest {
  amount: number;
  currency: 'AOA';
  description?: string;
  merchantTransactionId: string;
  paymentMethod: string;
  paymentInfo?: { phoneNumber: string };
  options: { MerchantIdentifier: string; ApiKey: string };
}

export interface AppPayChargeResponse {
  id?: string;
  transactionId?: string;
  merchantTransactionId?: string;
  reference?: string;
  paymentUrl?: string;
  expiresAt?: string;
  status?: number;
  responseStatus?: { reference?: { referenceNumber: string; entity: string; dueDate: string } };
  [key: string]: unknown;
}

@Injectable()
export class AppPayClient {
  private readonly logger = new Logger(AppPayClient.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value;
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.require('APPYPAY_CLIENT_ID'),
      client_secret: this.require('APPYPAY_CLIENT_SECRET'),
      resource: this.require('APPYPAY_RESOURCE'),
    });
    const response = await this.request(this.buildAuthUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(`App Pay authentication failed with status ${response.status}`);
    }
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('App Pay missing access_token');
    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  }

  async createCharge(request: AppPayChargeRequest): Promise<AppPayChargeResponse> {
    const baseUrl = this.require('APPYPAY_API_BASE_URL');
    const token = await this.getAccessToken();
    const response = await this.request(`${baseUrl}/v2.0/charges`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`AppPay charges failed ${response.status}: ${text}`);
      throw new Error(`App Pay charges request failed with status ${response.status}: ${text}`);
    }
    return (await response.json()) as AppPayChargeResponse;
  }

  private buildAuthUrl(): string {
    const template = this.require('APPYPAY_AUTH_URL');
    const tenant = this.config.get<string>('APPYPAY_TENANT');
    return tenant ? template.replaceAll('{tenant}', tenant) : template;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const rawTimeout = Number(this.config.get<string>('APPYPAY_HTTP_TIMEOUT_MS') ?? '10000');
    const timeoutMs = Math.min(Math.max(rawTimeout, 1000), 15000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value || value.trim().length === 0) {
      throw new Error(`App Pay configuration '${key}' is missing`);
    }
    return value;
  }
}
