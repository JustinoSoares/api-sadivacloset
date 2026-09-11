import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

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

    // ── 1) Prisma / DB errors (não são HttpException) → mapeia para 4xx seguro sem leak técnico
    const prismaMapped = this.mapPrismaError(exception);
    if (prismaMapped) {
      status = prismaMapped.status;
      message = prismaMapped.message;
      // Log detalhado só no servidor
      const rawMsg = exception instanceof Error ? exception.message : String(exception);
      const rawStack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `[Prisma ${prismaMapped.prismaCode ?? 'UNKNOWN'}] ${request.method} ${request.url} -> ${rawMsg}`,
        rawStack,
      );
      // Não expõe detalhes técnicos ao cliente — usa mensagem sanitizada
    } else if (exception instanceof HttpException) {
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

      // Sanitização para 5xx via HttpException: nunca vaza stack/tabela ao cliente
      if (status >= 500) {
        const rawForLog = typeof excResp === 'string' ? excResp : JSON.stringify(excResp);
        this.logger.error(
          `[${status}] ${request.method} ${request.url} HttpException -> ${rawForLog}`,
          exception.stack,
        );
        // Se mensagem contém padrão técnico, substitui por genérica
        if (this.looksTechnical(message)) {
          message = 'Ops! Algo deu errado. Tente novamente em instantes.';
        }
      }
    } else if (exception instanceof Error) {
      // Erro genérico (não-Pisma, não-Http): loga detalhes só no servidor, cliente vê genérico SEMPRE
      this.logger.error(`[${request.method} ${request.url}] ${exception.message}`, exception.stack);
      message = 'Ops! Algo deu errado. Tente novamente em instantes.';
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      // NUNCA expõe exception.message ao cliente (mesmo em dev/test), só no log
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

  private mapPrismaError(exception: unknown): { status: number; message: string; prismaCode?: string } | null {
    // Usa duck typing + instanceof para cobrir diferentes formas que o Prisma expõe o erro
    const anyExc = exception as any;
    const code: string | undefined = anyExc?.code;
    const name: string | undefined = anyExc?.name;
    const msg: string = anyExc?.message ?? '';

    const isKnown = code && /^P\d{4}$/.test(code);
    const isPrismaName = typeof name === 'string' && name.includes('Prisma');
    const isConnector = msg.includes('ConnectorError') || msg.includes('PostgresError') || msg.includes('QueryError');

    // Erros nativos do Postgres que o driver expõe sem wrapper Prisma (ex: 23001/23505)
    const isPostgresCode = code === '23001' || code === '23505' || code === '23503' || code === '23502';

    // PrismaClientValidation / Initialization / RustPanic
    const isPrismaClientError =
      name === 'PrismaClientValidationError' ||
      name === 'PrismaClientInitializationError' ||
      name === 'PrismaClientRustPanicError' ||
      name === 'PrismaClientUnknownRequestError';

    if (!isKnown && !isPrismaName && !isConnector && !isPostgresCode && !isPrismaClientError) {
      // Fallback heurístico: mensagens que contêm padrão Prisma mas sem code
      if (!msg.includes('Invalid `prisma.') && !msg.includes('prisma.')) return null;
    }

    // Log adicional para instanceof check (não falha se Prisma não estiver disponível)
    try {
      if (exception instanceof Prisma.PrismaClientKnownRequestError) {
        // já capturado via code, mas garante
      }
    } catch {
      // ignore
    }

    const prismaCode = code ?? (isPrismaClientError ? name : undefined);

    // Mapeamento de códigos conhecidos para respostas sem leak
    if (code === 'P2002' || code === '23505') {
      // Unique constraint violation
      const target = anyExc?.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(', ') : target ? String(target) : '';
      // Não expõe nome da tabela/coluna crua; usa mensagem genérica segura
      if (targetStr.toLowerCase().includes('email')) {
        return { status: HttpStatus.CONFLICT, message: 'Este e-mail já está em uso.', prismaCode };
      }
      return { status: HttpStatus.CONFLICT, message: 'Este registro já existe. Verifique os dados e tente novamente.', prismaCode };
    }

    if (code === 'P2003' || code === '23001' || code === '23503') {
      // Foreign key / Restrict violation
      if (msg.includes('order_items_product_id_fkey') || msg.includes('order_items') || msg.includes('products')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Não é possível concluir a operação porque este registro está em uso (ex: produto associado a encomendas).',
          prismaCode,
        };
      }
      if (msg.includes('order_') || msg.includes('fkey')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Não é possível concluir a operação porque este registro está vinculado a outros dados.',
          prismaCode,
        };
      }
      return { status: HttpStatus.CONFLICT, message: 'Não é possível concluir a operação porque este registro está em uso.', prismaCode };
    }

    if (code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, message: 'Registro não encontrado.', prismaCode };
    }

    if (code === 'P2000' || code === 'P2001' || code === 'P2011' || code === 'P2012' || code === 'P2014' || code === '23502') {
      return { status: HttpStatus.BAD_REQUEST, message: 'Dados inválidos. Verifique os campos e tente novamente.', prismaCode };
    }

    if (isKnown || isPostgresCode) {
      // Outros códigos Prisma conhecidos mas não mapeados especificamente -> genérico por categoria
      if (code && code.startsWith('P2')) {
        // P2xxx são erros de request -> 400 por defeito, exceto se já tratado acima
        return { status: HttpStatus.BAD_REQUEST, message: 'Dados inválidos. Verifique os campos e tente novamente.', prismaCode };
      }
    }

    if (isPrismaClientError || isConnector) {
      // Validação / inicialização / connector -> 500 genérico sanitizado (não vaza detalhes de conexão)
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Ops! Algo deu errado. Tente novamente em instantes.', prismaCode };
    }

    if (msg.includes('Invalid `prisma.') || msg.includes('ConnectorError')) {
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Ops! Algo deu errado. Tente novamente em instantes.', prismaCode };
    }

    return null;
  }

  private looksTechnical(message: string): boolean {
    if (!message) return false;
    const lowered = message.toLowerCase();
    const patterns = [
      'prisma',
      'connectorerror',
      'postgreserror',
      'postgres',
      'queryerror',
      'p2002',
      'p2003',
      'p2025',
      'invalid `prisma',
      'invalid `this.prisma',
      'at prisma',
      'at object.',
      'foreign key',
      'unique constraint',
      'violates',
      'constraint',
      'sql',
      'stack',
      'code: \"23001\"',
      'order_items_product_id_fkey',
      'table \"',
      'connectorerror',
    ];
    return patterns.some((p) => lowered.includes(p.toLowerCase()));
  }
}
