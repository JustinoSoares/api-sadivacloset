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

  it('deve formatar erro já no formato {error:{code,message}}', () => {
    const exc = new HttpException(
      { error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Já existe' } },
      HttpStatus.CONFLICT,
    );
    filter.catch(exc, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Já existe' },
    });
  });

  it('deve mapear class-validator array para VALIDATION_ERROR', () => {
    const exc = new HttpException(
      { message: ['field error'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    // o filter trata obj.message array como detalhes
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Validation failed' }),
      }),
    );
  });

  it('deve mapear string para codigo via status', () => {
    const exc = new HttpException('Erro simples', HttpStatus.BAD_REQUEST);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'BAD_REQUEST' }) }),
    );
  });

  it('deve mapear 429 para LIMITE_EXCEDIDO', () => {
    const exc = new HttpException({ message: 'Too Many Requests' }, HttpStatus.TOO_MANY_REQUESTS);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }) }),
    );
  });

  it('deve retornar ERRO_INTERNO para Error genérico', () => {
    const err = new Error('falha interna');
    filter.catch(err, createHost());
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_ERROR' }) }),
    );
  });

  it('deve preservar detalhes quando já vem em error.details', () => {
    const exc = new HttpException(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ field: 'nome' }],
        },
      },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [{ field: 'nome' }],
      },
    });
  });
});
