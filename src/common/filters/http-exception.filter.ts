import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';

interface MessagePayload {
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const excResp = exception.getResponse();

      if (typeof excResp === 'string') {
        message = excResp;
      } else if (typeof excResp === 'object' && excResp !== null) {
        const obj = excResp as Record<string, unknown>;
        // Preferred: { message: string }
        if (typeof obj['message'] === 'string' && obj['message']) {
          message = obj['message'] as string;
          // Se message vier como array (class-validator default sem filter), junta
          // mas normalmente já tratado pelo ValidationPipe
        } else if (Array.isArray(obj['message'])) {
          const arr = obj['message'] as unknown[];
          message = arr.map((v) => String(v)).join('; ');
        } else if (obj['error'] && typeof obj['error'] === 'object') {
          const err = obj['error'] as Record<string, unknown>;
          if (typeof err['message'] === 'string' && err['message']) {
            message = err['message'] as string;
            // Anexa details se houver para não perder info, mas mantém só message
            if (err['details']) {
              const detailsStr = this.detailsToString(err['details']);
              if (detailsStr) message = `${message}: ${detailsStr}`;
            }
          } else if (typeof err['details'] === 'string') {
            message = err['details'] as string;
          }
        } else if (obj['erro'] && typeof obj['erro'] === 'object') {
          const erro = obj['erro'] as Record<string, unknown>;
          const raw =
            (erro['mensagem'] as string) ?? (obj['message'] as string) ?? (obj['mensagem'] as string) ?? '';
          if (raw) message = this.translateMessage(raw);
          const detalhes = erro['detalhes'] ?? obj['detalhes'] ?? obj['details'];
          if (detalhes) {
            const dStr = this.detailsToString(detalhes);
            if (dStr) message = `${message}: ${dStr}`;
          }
        } else if (typeof obj['mensagem'] === 'string' && obj['mensagem']) {
          message = this.translateMessage(obj['mensagem'] as string);
        } else if (typeof obj['error'] === 'string' && obj['error']) {
          message = obj['error'] as string;
        } else if (typeof obj['msg'] === 'string' && obj['msg']) {
          message = obj['msg'] as string;
        } else {
          // Fallback: tenta extrair message ou usa stringify curto
          const fallback = (obj['message'] as string) ?? (obj['error'] as string) ?? '';
          if (fallback && typeof fallback === 'string') message = fallback;
        }

        // Caso ainda seja array de mensagens
        if (Array.isArray((obj as any).message)) {
          message = (obj as any).message.map((v: unknown) => String(v)).join('; ');
        }

        // Se mensagem ainda vazia, tenta traduzir code genérico
        if (!message || message === 'An unexpected error occurred.') {
          const code = (obj['code'] as string) ?? (obj['codigo'] as string) ?? '';
          if (code) message = this.codeToMessage(code);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[${request.method} ${request.url}] ${exception.message}`, exception.stack);
      message = 'An unexpected error occurred.';
      // Em dev/test mostra mensagem real para debug, em prod mantém genérica
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message || message;
      }
    } else {
      this.logger.error(`[${request.method} ${request.url}] Unknown error`, String(exception));
    }

    // Garante mensagem sempre string não vazia
    if (!message || typeof message !== 'string' || !message.trim()) {
      message = this.codeToMessage(this.codeFromStatus(status));
    }

    const payload: MessagePayload = { message };

    if (status >= 500) {
      this.logger.error(`[${status}] ${request.method} ${request.url} -> ${message}`);
    }

    response.status(status).json(payload);
  }

  private detailsToString(details: unknown): string {
    if (!details) return '';
    if (typeof details === 'string') return details;
    if (Array.isArray(details)) {
      return details
        .map((d) => {
          if (typeof d === 'string') return d;
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>;
            const field = (o['field'] as string) ?? (o['campo'] as string) ?? '';
            const errors = (o['errors'] as unknown) ?? (o['erros'] as unknown) ?? o['message'] ?? '';
            const errStr = Array.isArray(errors) ? errors.join(', ') : String(errors);
            return field ? `${field}: ${errStr}` : errStr;
          }
          return String(d);
        })
        .filter(Boolean)
        .join('; ');
    }
    if (typeof details === 'object') {
      const o = details as Record<string, unknown>;
      if (o['available'] !== undefined || o['requested'] !== undefined) {
        return JSON.stringify(details);
      }
      return JSON.stringify(details);
    }
    return String(details);
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMIT_EXCEEDED';
      default:
        if (status >= 500) return 'INTERNAL_ERROR';
        return 'ERROR';
    }
  }

  private codeToMessage(code: string): string {
    const map: Record<string, string> = {
      BAD_REQUEST: 'Bad request',
      VALIDATION_ERROR: 'Validation failed',
      UNAUTHENTICATED: 'Not authenticated',
      INVALID_CREDENTIALS: 'Invalid email or password',
      TOKEN_INVALID: 'Invalid token',
      TOKEN_EXPIRED: 'Token expired',
      TOKEN_REVOKED: 'Token revoked',
      ACCOUNT_INACTIVE: 'Account is inactive',
      FORBIDDEN: 'Access denied',
      NOT_FOUND: 'Resource not found',
      CONFLICT: 'Conflict',
      EMAIL_ALREADY_EXISTS: 'Email already exists',
      RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
      INTERNAL_ERROR: 'An unexpected error occurred.',
      INSUFFICIENT_STOCK: 'Insufficient stock',
      CART_EMPTY: 'Cart is empty',
      ADDRESS_IN_USE: 'Address in use',
      ORDER_ALREADY_CANCELLED: 'Order already cancelled',
      ORDER_NOT_CANCELLABLE: 'Order not cancellable',
      DELIVERY_IN_PROGRESS: 'Delivery in progress',
      INVALID_METHOD: 'Invalid payment method',
      MISSING_SIGNATURE: 'Missing signature',
      INVALID_SIGNATURE: 'Invalid signature',
      MISSING_REFERENCE: 'Missing external reference',
    };
    return map[code] ?? code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  private translateMessage(msg: string): string {
    const map: Record<string, string> = {
      'Erro de validação': 'Validation failed',
      'Token não fornecido': 'Token not provided',
      'Token inválido': 'Invalid token',
      'Token expirado': 'Token expired',
      'Ocorreu um erro inesperado.': 'An unexpected error occurred.',
      'Demasiadas tentativas. Tente novamente mais tarde.': 'Too many requests. Please try again later.',
      'Não autenticado': 'Not authenticated',
      'Acesso negado': 'Access denied',
      'Não encontrado': 'Not found',
    };
    return map[msg] ?? msg;
  }
}
