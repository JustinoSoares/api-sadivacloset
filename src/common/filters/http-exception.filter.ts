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
    let message = 'Ops! Algo deu errado. Tente novamente em instantes.';

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
        if (!message || message === 'Ops! Algo deu errado. Tente novamente em instantes.' || message === 'An unexpected error occurred.') {
          const code = (obj['code'] as string) ?? (obj['codigo'] as string) ?? '';
          if (code) message = this.codeToMessage(code);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[${request.method} ${request.url}] ${exception.message}`, exception.stack);
      message = 'Ops! Algo deu errado. Tente novamente em instantes.';
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
      BAD_REQUEST: 'Pedido inválido. Verifique os dados enviados.',
      VALIDATION_ERROR: 'Dados inválidos. Verifique os campos e tente novamente.',
      UNAUTHENTICATED: 'Você precisa estar autenticado. Faça login para continuar.',
      INVALID_CREDENTIALS: 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.',
      TOKEN_INVALID: 'Sessão inválida. Por favor, faça login novamente.',
      TOKEN_EXPIRED: 'Sua sessão expirou. Por favor, faça login novamente.',
      TOKEN_REVOKED: 'Sessão encerrada. Por favor, faça login novamente.',
      ACCOUNT_INACTIVE: 'Sua conta está desativada. Entre em contato com o suporte.',
      FORBIDDEN: 'Você não tem permissão para acessar este recurso.',
      NOT_FOUND: 'Registro não encontrado.',
      CONFLICT: 'Conflito: este dado já está em uso.',
      EMAIL_ALREADY_EXISTS: 'Este e-mail já está cadastrado. Use outro e-mail ou faça login.',
      RATE_LIMIT_EXCEEDED: 'Muitas tentativas. Aguarde um momento e tente novamente.',
      INTERNAL_ERROR: 'Ops! Algo deu errado. Tente novamente em instantes.',
      INSUFFICIENT_STOCK: 'Estoque insuficiente para este produto.',
      CART_EMPTY: 'Seu carrinho está vazio.',
      ADDRESS_IN_USE: 'Este endereço não pode ser removido pois está vinculado a pedidos pendentes.',
      ORDER_ALREADY_CANCELLED: 'Este pedido já foi cancelado.',
      ORDER_NOT_CANCELLABLE: 'Este pedido não pode mais ser cancelado.',
      DELIVERY_IN_PROGRESS: 'A entrega já está em andamento e não pode ser alterada.',
      INVALID_METHOD: 'Método de pagamento inválido.',
      MISSING_SIGNATURE: 'Assinatura não informada.',
      INVALID_SIGNATURE: 'Assinatura inválida.',
      MISSING_REFERENCE: 'Referência não informada.',
    };
    return map[code] ?? 'Ops! Algo deu errado. Tente novamente.';
  }

  private translateMessage(msg: string): string {
    const map: Record<string, string> = {
      'Validation failed': 'Dados inválidos. Verifique os campos e tente novamente.',
      'Token not provided': 'Você precisa estar autenticado. Faça login para continuar.',
      'Token expired': 'Sua sessão expirou. Por favor, faça login novamente.',
      'Invalid token': 'Sessão inválida. Por favor, faça login novamente.',
      'An unexpected error occurred.': 'Ops! Algo deu errado. Tente novamente em instantes.',
      'Too many requests. Please try again later.': 'Muitas tentativas. Aguarde um momento e tente novamente.',
      'Not authenticated': 'Você precisa estar autenticado. Faça login para continuar.',
      'Access denied': 'Você não tem permissão para acessar este recurso.',
      'Not found': 'Registro não encontrado.',
      'Invalid email or password': 'E-mail ou senha incorretos.',
      'Insufficient stock': 'Estoque insuficiente.',
      'Cart is empty': 'Seu carrinho está vazio.',
      'Product not found': 'Produto não encontrado.',
      'Cart item not found': 'Item do carrinho não encontrado.',
      'Order not found': 'Pedido não encontrado.',
      'Address not found': 'Endereço não encontrado.',
      'User not found': 'Usuário não encontrado.',
      'Resource not found': 'Registro não encontrado.',
      'Delivery zone not found': 'Zona de entrega não encontrada.',
      'Payment not found': 'Pagamento não encontrado.',
    };
    // Se mensagem contém prefixo técnico "Validation failed: ..." mantém mas traduz prefixo
    if (msg.startsWith('Validation failed')) return msg.replace('Validation failed', 'Dados inválidos');
    if (msg.startsWith('Insufficient stock')) return 'Estoque insuficiente para este produto.';
    return map[msg] ?? msg;
  }
}
