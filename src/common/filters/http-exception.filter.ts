import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ErroPayload {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
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
    let codigo = 'ERRO_INTERNO';
    let mensagem = 'Ocorreu um erro inesperado.';
    let detalhes: unknown | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const excResp = exception.getResponse();

      if (typeof excResp === 'string') {
        mensagem = excResp;
        codigo = this.codigoFromStatus(status);
      } else if (typeof excResp === 'object' && excResp !== null) {
        const obj = excResp as Record<string, unknown>;
        // Se já vem no formato { erro: { codigo, mensagem } } passa direto
        if (obj['erro'] && typeof obj['erro'] === 'object') {
          const erro = obj['erro'] as Record<string, unknown>;
          codigo = (erro['codigo'] as string) ?? this.codigoFromStatus(status);
          mensagem = (erro['mensagem'] as string) ?? (obj['message'] as string) ?? mensagem;
          detalhes = erro['detalhes'] ?? obj['detalhes'];
        } else {
          mensagem = (obj['message'] as string) ?? (obj['mensagem'] as string) ?? mensagem;
          codigo = (obj['codigo'] as string) ?? this.codigoFromStatus(status);
          // class-validator retorna message como array
          if (Array.isArray(obj['message'])) {
            mensagem = 'Erro de validação';
            detalhes = obj['message'];
            codigo = 'ERRO_VALIDACAO';
          } else if (obj['detalhes']) {
            detalhes = obj['detalhes'];
          }
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[${request.method} ${request.url}] ${exception.message}`, exception.stack);
      // Não expor stack em produção
      mensagem = 'Ocorreu um erro inesperado.';
    } else {
      this.logger.error(`[${request.method} ${request.url}] Erro desconhecido`, String(exception));
    }

    const payload: ErroPayload = {
      erro: {
        codigo,
        mensagem,
        ...(detalhes !== undefined ? { detalhes } : {}),
      },
    };

    // Log 4xx como warn, 5xx como error
    if (status >= 500) {
      this.logger.error(`[${status}] ${request.method} ${request.url} -> ${codigo}: ${mensagem}`);
    }

    response.status(status).json(payload);
  }

  private codigoFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'PEDIDO_INVALIDO';
      case 401:
        return 'NAO_AUTENTICADO';
      case 403:
        return 'ACESSO_NEGADO';
      case 404:
        return 'NAO_ENCONTRADO';
      case 409:
        return 'CONFLITO';
      case 422:
        return 'ERRO_VALIDACAO';
      case 429:
        return 'LIMITE_EXCEDIDO';
      default:
        if (status >= 500) return 'ERRO_INTERNO';
        return 'ERRO';
    }
  }
}
