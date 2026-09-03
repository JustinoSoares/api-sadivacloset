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

  it('deve retornar message para Error genérico (500)', () => {
    const err = new Error('falha interna');
    filter.catch(err, createHost());
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
    );
    // Em test NODE_ENV != production, mostra mensagem real
    expect(jsonMock.mock.calls[0][0].message).toBe('falha interna');
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
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Token not provided',
    });
  });
});
