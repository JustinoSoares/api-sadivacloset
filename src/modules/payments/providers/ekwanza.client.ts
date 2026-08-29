import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

export interface EkwanzaCreateTicketRequest {
  amount: number;
  referenceCode: string;
  mobileNumber: string;
  description?: string;
}

export interface EkwanzaCreateTicketResponse {
  Code: string | null;
  QRCode: string | null;
  Range: { MinValue: number; MaxValue: number } | null;
  Status: number;
  ExpirationDate: string | null;
}

export interface EkwanzaSendKwikToCustomerRequest {
  iban: string;
  amount: number;
  operationCode: string;
}

export interface EkwanzaSendKwikToCustomerResponse {
  ekzOperationCode: string | null;
  ekzTransactionCode: string | null;
  status: string | number | null;
}

@Injectable()
export class EkwanzaClient {
  private readonly logger = new Logger(EkwanzaClient.name);
  constructor(private readonly config: ConfigService) {}

  async createTicket(request: EkwanzaCreateTicketRequest): Promise<EkwanzaCreateTicketResponse> {
    const baseUrl = this.require('EKWANZA_API_BASE_URL');
    const token = this.require('EKWANZA_NOTIFICATION_TOKEN');
    const params = new URLSearchParams({
      amount: String(request.amount),
      referenceCode: request.referenceCode,
      mobileNumber: request.mobileNumber,
    });
    if (request.description) params.set('description', request.description.trim());
    const response = await this.request(`${baseUrl}/Ticket/${token}?${params.toString()}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`E-Kwanza ticket failed ${response.status}: ${text}`);
      throw new Error(`E-Kwanza ticket request failed with status ${response.status}`);
    }
    return (await response.json()) as EkwanzaCreateTicketResponse;
  }

  async sendKwikToCustomer(request: EkwanzaSendKwikToCustomerRequest): Promise<EkwanzaSendKwikToCustomerResponse> {
    const baseUrl = this.require('EKWANZA_API_BASE_URL');
    const token = this.require('EKWANZA_NOTIFICATION_TOKEN');
    const apiKey = this.require('EKWANZA_API_KEY');
    const timestamp = new Date().toISOString();
    const signature = createHmac('sha256', apiKey).update([timestamp, request.iban, token, request.operationCode].join('')).digest('hex');
    const response = await this.request(`${baseUrl}/Operations/SendKWiKToCustomer`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        data: { IBAN: request.iban, token, amount: String(request.amount), operationCode: request.operationCode },
        meta: { timestamp, signature },
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`E-Kwanza KWiK failed ${response.status}: ${text}`);
      throw new Error(`E-Kwanza KWiK request failed with status ${response.status}: ${text}`);
    }
    return (await response.json()) as EkwanzaSendKwikToCustomerResponse;
  }

  async getTicketStatus(ticketCode: string): Promise<any> {
    const baseUrl = this.require('EKWANZA_API_BASE_URL');
    const token = this.require('EKWANZA_NOTIFICATION_TOKEN');
    const response = await this.request(`${baseUrl}/Ticket/${token}/${ticketCode}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`E-Kwanza ticket status failed ${response.status}`);
    return response.json();
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const rawTimeout = Number(this.config.get<string>('EKWANZA_HTTP_TIMEOUT_MS') ?? '10000');
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
    if (!value || value.trim().length === 0) throw new Error(`E-Kwanza configuration '${key}' is missing`);
    return value;
  }
}
