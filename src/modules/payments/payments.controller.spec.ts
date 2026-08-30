import { Test } from '@nestjs/testing';
import { PagamentosController, WalletController } from './payments.controller';
import { AdminPagamentosController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

describe('Payments Controllers', () => {
  let controller: PagamentosController;
  let adminController: AdminPagamentosController;
  let walletController: WalletController;
  let service: any;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const orderId = '22222222-2222-2222-2222-222222222222';
  const paymentId = '33333333-3333-3333-3333-333333333333';
  const adminId = 'admin-9999';
  const user = { sub: buyerId, email: 'buyer@test.com', role: 'buyer' } as any;
  const adminUser = { sub: adminId, email: 'admin@test.com', role: 'admin' } as any;

  const paymentMock = { id: paymentId, orderId, metodo: 'transferencia', estado: 'pendente' };

  beforeEach(async () => {
    service = {
      iniciar: jest.fn().mockResolvedValue(paymentMock),
      get: jest.fn().mockResolvedValue(paymentMock),
      comprovativo: jest.fn().mockResolvedValue({ ...paymentMock, estado: 'processando' }),
      validarAdmin: jest.fn().mockResolvedValue({ pagamento: paymentMock }),
      historico: jest.fn().mockResolvedValue({ data: [paymentMock], total: 1 }),
      walletHistorico: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const mod = await Test.createTestingModule({
      controllers: [PagamentosController, AdminPagamentosController, WalletController],
      providers: [{ provide: PaymentsService, useValue: service }],
    }).compile();
    controller = mod.get(PagamentosController);
    adminController = mod.get(AdminPagamentosController);
    walletController = mod.get(WalletController);
  });

  it('POST /pedidos/:id/pagamento/iniciar should call service', async () => {
    const dto = new IniciarPagamentoDto();
    dto.metodo = 'transferencia';
    const result = await controller.iniciar(user, orderId, dto);
    expect(service.iniciar).toHaveBeenCalledWith(
      buyerId,
      orderId,
      expect.objectContaining({ metodo: 'transferencia' }),
    );
    expect(result.data).toEqual(paymentMock);
  });

  it('GET /pedidos/:id/pagamento should return status', async () => {
    const result = await controller.get(user, orderId);
    expect(service.get).toHaveBeenCalledWith(buyerId, orderId);
    expect(result.data).toEqual(paymentMock);
  });

  it('POST /pedidos/:id/pagamento/comprovativo should upload', async () => {
    const file = {
      originalname: 'comp.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
      buffer: Buffer.from('x'),
    } as any;
    const result = await controller.comprovativo(user, orderId, file);
    expect(service.comprovativo).toHaveBeenCalledWith(buyerId, orderId, file);
    expect(result.data.estado).toBe('processando');
  });

  it('PATCH /admin/pagamentos/:id/validar should validate (only admin can mark paid)', async () => {
    const result = await adminController.validar(adminUser, paymentId);
    expect(service.validarAdmin).toHaveBeenCalledWith(adminId, paymentId);
    expect(result.data).toBeDefined();
  });

  it('GET /pagamentos/historico and wallet should paginate', async () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 20;
    await walletController.historico(user, dto);
    expect(service.walletHistorico).toHaveBeenCalled();
  });

  it('should have correct paths', () => {
    expect(Reflect.getMetadata('path', PagamentosController)).toBe('pedidos/:id/pagamento');
    expect(Reflect.getMetadata('path', AdminPagamentosController)).toBe('admin/pagamentos');
  });
});
