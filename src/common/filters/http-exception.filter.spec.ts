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

  it('deve formatar erro já no formato {erro:{codigo,mensagem}}', () => {
    const exc = new HttpException(
      { erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Já existe' } },
      HttpStatus.CONFLICT,
    );
    filter.catch(exc, createHost());
    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      erro: { codigo: 'EMAIL_JA_EXISTE', mensagem: 'Já existe' },
    });
  });

  it('deve mapear class-validator array para ERRO_VALIDACAO', () => {
    const exc = new HttpException(
      { message: ['field error'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    // o filter trata obj.message array como detalhes
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        erro: expect.objectContaining({ codigo: 'ERRO_VALIDACAO', mensagem: 'Erro de validação' }),
      }),
    );
  });

  it('deve mapear string para codigo via status', () => {
    const exc = new HttpException('Erro simples', HttpStatus.BAD_REQUEST);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ codigo: 'PEDIDO_INVALIDO' }) }),
    );
  });

  it('deve mapear 429 para LIMITE_EXCEDIDO', () => {
    const exc = new HttpException({ message: 'Too Many Requests' }, HttpStatus.TOO_MANY_REQUESTS);
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ codigo: 'LIMITE_EXCEDIDO' }) }),
    );
  });

  it('deve retornar ERRO_INTERNO para Error genérico', () => {
    const err = new Error('falha interna');
    filter.catch(err, createHost());
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ erro: expect.objectContaining({ codigo: 'ERRO_INTERNO' }) }),
    );
  });

  it('deve preservar detalhes quando já vem em erro.detalhes', () => {
    const exc = new HttpException(
      {
        erro: {
          codigo: 'ERRO_VALIDACAO',
          mensagem: 'Erro de validação',
          detalhes: [{ campo: 'nome' }],
        },
      },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, createHost());
    expect(jsonMock).toHaveBeenCalledWith({
      erro: {
        codigo: 'ERRO_VALIDACAO',
        mensagem: 'Erro de validação',
        detalhes: [{ campo: 'nome' }],
      },
    });
  });
});
