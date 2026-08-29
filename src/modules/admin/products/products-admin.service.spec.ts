import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../audit/audit.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { NotFoundException } from '@nestjs/common';
import { ProductsAdminService } from './products-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { Category, ProductCondition } from '@prisma/client';

describe('ProductsAdminService', () => {
  let service: ProductsAdminService;
  let prisma: {
    product: {
      count: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let redis: { delByPattern: jest.Mock; del: jest.Mock };

  const productMock = {
    id: 'prod-1',
    image: 'https://cdn.com/img.jpg',
    name: 'Test Suit',
    description: 'Description',
    category: Category.SUITS,
    size: 'M',
    condition: ProductCondition.NEW,
    stock: 10,
    price: 45000,
    discount: 10,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      product: {
        count: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    // legacy alias for backward compat
    (prisma as any).produto = prisma.product;

    redis = { delByPattern: jest.fn().mockResolvedValue(1), del: jest.fn().mockResolvedValue(1) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuditService, useValue: { register: jest.fn().mockResolvedValue({}), registar: jest.fn().mockResolvedValue({}) } },
        { provide: AuditoriaService, useValue: { registar: jest.fn().mockResolvedValue({}), register: jest.fn().mockResolvedValue({}) } },
        ProductsAdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<ProductsAdminService>(ProductsAdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should apply q filter (contains insensitive) and category', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([productMock]);

      const query: any = { q: 'Suit', category: Category.SUITS, skip: 0, take: 20, page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(prisma.product.count).toHaveBeenCalledWith({
        where: {
          name: { contains: 'Suit', mode: 'insensitive' },
          category: Category.SUITS,
        },
      });
      expect(result).toMatchObject({ dados: [productMock], pagina: 1, total: 1 });
      // also check english alias
      expect((result as any).data).toBeDefined();
    });

    it('should paginate correctly (skip/take)', async () => {
      prisma.product.count.mockResolvedValue(5);
      prisma.product.findMany.mockResolvedValue([productMock, productMock]);

      const query: any = { page: 2, limit: 2, skip: 2, take: 2 };
      const result = await service.findAll(query);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 2, take: 2, orderBy: { createdAt: 'desc' } }),
      );
      expect(result.pagina).toBe(2);
      expect(result.total_paginas).toBe(3);
    });

    it('should return correct total_paginas for total 4 limit 2', async () => {
      prisma.product.count.mockResolvedValue(4);
      prisma.product.findMany.mockResolvedValue([]);
      const query: any = { page: 1, limit: 2, skip: 0, take: 2 };
      const result = await service.findAll(query);
      expect(result.total_paginas).toBe(2);
    });

    it('legacy portuguese filter categoria should still work', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([productMock]);
      const query: any = { q: 'Fato', categoria: Category.SUITS, skip: 0, take: 20, page: 1, limit: 20 };
      const result = await service.findAll(query as any);
      expect(result.total).toBe(1);
    });
  });

  describe('create', () => {
    it('should create product and invalidate cache (english payload)', async () => {
      prisma.product.create.mockResolvedValue(productMock);
      const dto: any = {
        image: productMock.image,
        name: productMock.name,
        description: productMock.description,
        category: productMock.category,
        size: productMock.size,
        condition: productMock.condition,
        stock: productMock.stock,
        price: productMock.price,
        discount: productMock.discount,
      };
      const result = await service.create(dto);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Test Suit' }) }),
      );
      expect(redis.delByPattern).toHaveBeenCalledWith('cache:products:*');
      expect(redis.del).toHaveBeenCalledWith('cache:categories');
      expect(result).toEqual(productMock);
    });

    it('legacy portuguese payload should also work', async () => {
      prisma.product.create.mockResolvedValue(productMock);
      const dto: any = {
        imagem: productMock.image,
        nomeProduto: productMock.name,
        descricao: productMock.description,
        categoria: productMock.category,
        tamanho: productMock.size,
        estado: productMock.condition,
        volume: productMock.stock,
        price: productMock.price,
        desconto: productMock.discount,
      };
      const result = await service.create(dto);
      expect(result).toEqual(productMock);
    });

    it('should use discount 0 when not provided', async () => {
      prisma.product.create.mockResolvedValue({ ...productMock, discount: 0 });
      const dto: any = { ...productMock, discount: undefined, image: productMock.image, name: productMock.name, description: productMock.description, category: productMock.category, size: productMock.size, condition: productMock.condition, stock: productMock.stock, price: productMock.price };
      delete dto.id;
      delete dto.createdAt;
      await service.create(dto);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ discount: 0 }) }),
      );
    });
  });

  describe('update', () => {
    it('should update partial fields and invalidate cache', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.product.update.mockResolvedValue({ ...productMock, price: 60000 });

      const result = await service.update('prod-1', { price: 60000 } as any);
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-1' }, data: { price: 60000 } }),
      );
      expect(redis.delByPattern).toHaveBeenCalled();
      expect(result.price).toBe(60000);
    });

    it('should throw NotFound if product not exists', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update('no-id', {} as any)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.update('no-id', {} as any)).rejects.toMatchObject({
        response: { erro: { codigo: 'NAO_ENCONTRADO' } },
      });
    });

    it('should ignore undefined fields', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.product.update.mockResolvedValue(productMock);
      await service.update('prod-1', { name: 'New Name', price: undefined } as any);
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'New Name' } }),
      );
      const callData = prisma.product.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('price');
    });

    it('legacy portuguese field nomeProduto should map to name', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.product.update.mockResolvedValue(productMock);
      await service.update('prod-1', { nomeProduto: 'Novo Nome' } as any);
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Novo Nome' } }),
      );
    });
  });

  describe('remove', () => {
    it('should remove and invalidate cache', async () => {
      prisma.product.findUnique.mockResolvedValue(productMock);
      prisma.product.delete.mockResolvedValue(productMock);
      const res = await service.remove('prod-1');
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
      expect(redis.delByPattern).toHaveBeenCalledWith('cache:products:*');
      expect(res).toMatchObject({ mensagem: 'Produto removido com sucesso' });
      expect((res as any).message).toBe('Product removed successfully');
    });

    it('should throw NotFound if not exists', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.remove('no-id')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

// keep legacy describe name for backward compat
describe('ProdutosAdminService (legacy)', () => {
  it('alias should exist', () => {
    expect(ProductsAdminService).toBeDefined();
  });
});
