import { HttpExceptionFilter } from './http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // silencia logs de erro esperados no teste de Error genérico
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createHost(): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'GET', url: '/test' }),
      }),
      getArgByIndex: () => null,
      getArgs: () => [],
      getType: () => 'http',
      switchToRpc: () => null as any,
      switchToWs: () => null as any,
    } as unknown as ArgumentsHost;
  }

  it('deve formatar erro já no formato {error:{code,message}} para {message}', () => {
    const exc = new HttpException(
      { error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Já existe' } },
      HttpStatus.CONFLICT,
    );
    filter.catch(exc, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Já existe',
    });
  });

  it('deve mapear class-validator array para message concatenada', () => {
    const exc = new HttpException(
      { message: ['field error'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'field error',
      }),
    );
  });

  it('deve mapear string para message direta', () => {
    const exc = new HttpException('Erro simples', HttpStatus.BAD_REQUEST);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Erro simples' }),
    );
  });

  it('deve mapear 429 para message', () => {
    const exc = new HttpException({ message: 'Too Many Requests' }, HttpStatus.TOO_MANY_REQUESTS);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Too Many Requests' }),
    );
  });

  it('deve retornar message genérica para Error genérico (500) sem vazar detalhes', () => {
    const err = new Error('falha interna com detalhes sensíveis ConnectorError');
    filter.catch(err, createHost());
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ops! Algo deu errado. Tente novamente em instantes.' }),
    );
    // Cliente NUNCA vê mensagem técnica, só log no servidor
    expect(jsonMock.mock.calls[0][0].message).not.toBe('falha interna com detalhes sensíveis ConnectorError');
    expect(jsonMock.mock.calls[0][0].message).not.toContain('ConnectorError');
  });

  it('deve sanitizar Prisma P2003 (FK restrict) para 409 sem vazar detalhes de tabela', () => {
    const prismaError: any = new Error(
      'Invalid `this.prisma.product.delete()` invocation:\nConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "23001", message: "update or delete on table \\"products\\" violates RESTRICT setting of foreign key constraint \\"order_items_product_id_fkey\\"" }) })',
    );
    prismaError.code = 'P2003';
    prismaError.meta = { field_name: 'order_items_product_id_fkey' };
    prismaError.name = 'PrismaClientKnownRequestError';
    filter.catch(prismaError, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    const msg = jsonMock.mock.calls[0][0].message as string;
    expect(msg).not.toContain('ConnectorError');
    expect(msg).not.toContain('order_items');
    expect(msg).not.toContain('PostgresError');
    expect(msg.toLowerCase()).toContain('em uso');
  });

  it('deve sanitizar Prisma P2002 (unique) para 409 sem vazar detalhes', () => {
    const prismaError: any = new Error('Unique constraint failed on the fields: (`email`)');
    prismaError.code = 'P2002';
    prismaError.meta = { target: ['email'] };
    prismaError.name = 'PrismaClientKnownRequestError';
    filter.catch(prismaError, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    const msg = jsonMock.mock.calls[0][0].message as string;
    expect(msg).not.toContain('Unique constraint');
    // Mensagem segura em PT, sem leak de coluna
    expect(msg.toLowerCase()).toMatch(/já|uso|existe/);
  });

  it('deve sanitizar Postgres 23001 bruto para 409 sem leak', () => {
    const err: any = new Error('update or delete on table "products" violates RESTRICT');
    err.code = '23001';
    filter.catch(err, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock.mock.calls[0][0].message).not.toContain('products');
  });

  it('deve sanitizar HttpException 500 com mensagem técnica para genérica', () => {
    const exc = new HttpException('ConnectorError: PostgresError code 23001', HttpStatus.INTERNAL_SERVER_ERROR);
    filter.catch(exc, createHost());
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Ops! Algo deu errado. Tente novamente em instantes.',
    });
  });

  it('deve preservar detalhes concatenando em message quando já vem em error.details', () => {
    const exc = new HttpException(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ field: 'nome', errors: ['não deve estar vazio'] }],
        },
      },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Validation failed: nome: não deve estar vazio',
    });
  });

  it('deve traduzir erro legado {erro:{codigo,mensagem}} para message', () => {
    const exc = new HttpException(
      { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Token não fornecido' } } as any,
      HttpStatus.UNAUTHORIZED,
    );
    filter.catch(exc, createHost());
    // Filtro mantém mensagem em PT (não vaza inglês técnico), mapeia via translateMessage
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Token não fornecido',
    });
  });
});
