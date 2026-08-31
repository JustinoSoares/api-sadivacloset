import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const excResp = exception.getResponse();

      if (typeof excResp === 'string') {
        message = excResp;
        code = this.codeFromStatus(status);
      } else if (typeof excResp === 'object' && excResp !== null) {
        const obj = excResp as Record<string, unknown>;
        // If already in format { error: { code, message } } pass through
        if (obj['error'] && typeof obj['error'] === 'object') {
          const err = obj['error'] as Record<string, unknown>;
          code = (err['code'] as string) ?? this.codeFromStatus(status);
          message = (err['message'] as string) ?? (obj['message'] as string) ?? message;
          details = err['details'] ?? obj['details'];
        } else if (obj['erro'] && typeof obj['erro'] === 'object') {
          // Backward compatibility: translate legacy Portuguese keys
          const erro = obj['erro'] as Record<string, unknown>;
          code = this.translateCode((erro['codigo'] as string) ?? this.codeFromStatus(status));
          message = this.translateMessage((erro['mensagem'] as string) ?? (obj['message'] as string) ?? message);
          details = erro['detalhes'] ?? obj['detalhes'];
          // Translate details field names if present
          if (Array.isArray(details)) {
            details = (details as Record<string, unknown>[]).map((d) => ({
              field: (d['campo'] as string) ?? (d['field'] as string),
              errors: (d['erros'] as unknown) ?? (d['errors'] as unknown),
            }));
          }
        } else {
          message = (obj['message'] as string) ?? (obj['mensagem'] as string) ?? message;
          code = this.translateCode((obj['code'] as string) ?? (obj['codigo'] as string) ?? this.codeFromStatus(status));
          // class-validator returns message as array
          if (Array.isArray(obj['message'])) {
            message = 'Validation failed';
            details = obj['message'];
            code = 'VALIDATION_ERROR';
          } else if (obj['details'] || obj['detalhes']) {
            details = obj['details'] ?? obj['detalhes'];
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[${request.method} ${request.url}] ${exception.message}`, exception.stack);
      message = 'An unexpected error occurred.';
    } else {
      this.logger.error(`[${request.method} ${request.url}] Unknown error`, String(exception));
    }

    const payload: ErrorPayload = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    };

    // Log 4xx as warn, 5xx as error
    if (status >= 500) {
      this.logger.error(`[${status}] ${request.method} ${request.url} -> ${code}: ${message}`);
    }

    response.status(status).json(payload);
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

  private translateCode(code: string): string {
    const map: Record<string, string> = {
      ERRO_VALIDACAO: 'VALIDATION_ERROR',
      PEDIDO_INVALIDO: 'BAD_REQUEST',
      NAO_AUTENTICADO: 'UNAUTHENTICATED',
      CREDENCIAIS_INVALIDAS: 'INVALID_CREDENTIALS',
      TOKEN_INVALIDO: 'INVALID_TOKEN',
      TOKEN_EXPIRADO: 'TOKEN_EXPIRED',
      TOKEN_REVOGADO: 'REVOKED_TOKEN',
      CONTA_INATIVA: 'ACCOUNT_INACTIVE',
      ACESSO_NEGADO: 'FORBIDDEN',
      NAO_ENCONTRADO: 'NOT_FOUND',
      CONFLITO: 'CONFLICT',
      EMAIL_JA_EXISTE: 'EMAIL_ALREADY_EXISTS',
      LIMITE_EXCEDIDO: 'RATE_LIMIT_EXCEEDED',
      ERRO_INTERNO: 'INTERNAL_ERROR',
      STOCK_INSUFICIENTE: 'INSUFFICIENT_STOCK',
      CARRINHO_VAZIO: 'CART_EMPTY',
      ENDERECO_EM_USO: 'ADDRESS_IN_USE',
      PEDIDO_JA_CANCELADO: 'ORDER_ALREADY_CANCELLED',
      PEDIDO_NAO_CANCELAVEL: 'ORDER_NOT_CANCELLABLE',
      ENTREGA_EM_CURSO: 'DELIVERY_IN_PROGRESS',
      ENTREGA_JA_CANCELADA: 'DELIVERY_ALREADY_CANCELLED',
      PEDIDO_CANCELADO: 'ORDER_CANCELLED',
      PEDIDO_JA_PAGO: 'ORDER_ALREADY_PAID',
      PAGAMENTO_JA_VALIDADO: 'PAYMENT_ALREADY_VALIDATED',
      METODO_INVALIDO: 'INVALID_PAYMENT_METHOD',
      FICHEIRO_OBRIGATORIO: 'FILE_REQUIRED',
      FICHEIRO_MUITO_GRANDE: 'FILE_TOO_LARGE',
      FORMATO_INVALIDO: 'INVALID_FORMAT',
      ASSINATURA_EM_FALTA: 'MISSING_SIGNATURE',
      ASSINATURA_INVALIDA: 'INVALID_SIGNATURE',
      REFERENCIA_EM_FALTA: 'MISSING_REFERENCE',
    };
    return map[code] ?? code;
  }

  private translateMessage(msg: string): string {
    const map: Record<string, string> = {
      'Erro de validação': 'Validation failed',
      'Token não fornecido': 'Token not provided',
      'Token inválido': 'Invalid token',
      'Token expirado': 'Token expired',
      'Ocorreu um erro inesperado.': 'An unexpected error occurred.',
      'Demasiadas tentativas. Tente novamente mais tarde.': 'Too many requests. Please try again later.',
    };
    return map[msg] ?? msg;
  }
}
