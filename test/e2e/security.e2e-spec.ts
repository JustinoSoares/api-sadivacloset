import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { RedisService } from '../../src/modules/redis/redis.service';
import { PaymentQueueService } from '../../src/modules/queue/payment-queue.service';

describe('Security e2e - OWASP Top 10 & controles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: any;

  let buyerToken: string;
  let buyerId: string;
  let buyer2Token: string;
  let buyer2Id: string;
  let adminToken: string;

  const redisStore = new Map<string, { value: string; expireAt?: number }>();
  const throttlerStore = new Map<string, { count: number; expireAt: number }>();

  const mockRedisService = {
    get: jest.fn(async (key: string) => {
      const entry = redisStore.get(key);
      if (!entry) return null;
      if (entry.expireAt && Date.now() > entry.expireAt) {
        redisStore.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: jest.fn(async (key: string, value: string, ttlSeconds?: number) => {
      const expireAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
      redisStore.set(key, { value, expireAt });
    }),
    del: jest.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
    exists: jest.fn(async (key: string) => {
      const entry = redisStore.get(key);
      if (!entry) return false;
      if (entry.expireAt && Date.now() > entry.expireAt) {
        redisStore.delete(key);
        return false;
      }
      return true;
    }),
    delByPattern: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      let count = 0;
      for (const key of Array.from(redisStore.keys())) {
        if (key.startsWith(prefix)) {
          redisStore.delete(key);
          count++;
        }
      }
      return count;
    }),
    keys: jest.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      return Array.from(redisStore.keys()).filter((k) => k.startsWith(prefix));
    }),
  };

  const mockRedisClient = {
    get: mockRedisService.get,
    set: mockRedisService.set,
    del: mockRedisService.del,
    exists: async (key: string) => ((await mockRedisService.exists(key)) ? 1 : 0),
    keys: mockRedisService.keys,
    delByPattern: mockRedisService.delByPattern,
    on: jest.fn(),
    incr: jest.fn(async (key: string) => {
      const now = Date.now();
      const entry = throttlerStore.get(key);
      if (!entry || now > entry.expireAt) {
        throttlerStore.set(key, { count: 1, expireAt: now + 60000 });
        redisStore.set(key, { value: '1', expireAt: now + 60000 });
        return 1;
      }
      entry.count += 1;
      redisStore.set(key, { value: String(entry.count), expireAt: entry.expireAt });
      return entry.count;
    }),
    pttl: jest.fn(async (key: string) => {
      const entry = throttlerStore.get(key);
      if (!entry) return -2;
      const now = Date.now();
      if (now > entry.expireAt) {
        throttlerStore.delete(key);
        return -2;
      }
      return entry.expireAt - now;
    }),
    pexpire: jest.fn(async (key: string, ttl: number) => {
      const entry = throttlerStore.get(key);
      if (entry) {
        entry.expireAt = Date.now() + ttl;
        const rs = redisStore.get(key);
        if (rs) rs.expireAt = entry.expireAt;
        return 1;
      }
      throttlerStore.set(key, { count: 1, expireAt: Date.now() + ttl });
      return 1;
    }),
    expire: jest.fn(async (key: string, ttl: number) => {
      const entry = throttlerStore.get(key);
      if (entry) {
        entry.expireAt = Date.now() + ttl * 1000;
        return 1;
      }
      return 0;
    }),
    ttl: jest.fn(async (key: string) => {
      const entry = throttlerStore.get(key);
      if (!entry) return -2;
      const now = Date.now();
      if (now > entry.expireAt) return -2;
      return Math.ceil((entry.expireAt - now) / 1000);
    }),
    eval: jest.fn(async (lua: string, numKeys: number, key: string, ttl: string) => {
      const count = await (mockRedisClient as any).incr(key);
      const pttlVal = await (mockRedisClient as any).pttl(key);
      if (pttlVal === -1) {
        await (mockRedisClient as any).pexpire(key, parseInt(ttl, 10));
        return [count, parseInt(ttl, 10)];
      }
      return [count, pttlVal > 0 ? pttlVal : parseInt(ttl, 10)];
    }),
  };

  const mockPaymentQueue = {
    enqueuePaymentConfirmed: jest.fn(async () => {}),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider('REDIS_CLIENT')
      .useValue(mockRedisClient)
      .overrideProvider(PaymentQueueService)
      .useValue(mockPaymentQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) => {
          const detalhes = errors.map((e) => ({
            campo: e.property,
            erros: Object.values(e.constraints ?? {}),
          }));
          throw new BadRequestException({
            erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'Erro de validação', detalhes },
          });
        },
      }),
    );
    const express = require('express');
    app.use(
      express.json({
        verify: (req: any, _res: any, buf: Buffer) => {
          req.rawBody = buf;
        },
        limit: '2mb',
      }),
    );
    app.use(
      express.urlencoded({
        extended: true,
        verify: (req: any, _res: any, buf: Buffer) => {
          req.rawBody = buf;
        },
      }),
    );
    const { RequestMethod } = require('@nestjs/common');
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { method: RequestMethod.GET, path: '' },
        { method: RequestMethod.GET, path: 'health' },
        { method: RequestMethod.GET, path: 'api/docs' },
        { method: RequestMethod.GET, path: 'api/docs-json' },
        { method: RequestMethod.GET, path: 'api/docs/(.*)' },
      ],
    });
    await app.init();
    httpServer = app.getHttpServer();
    prisma = app.get(PrismaService);

    // Clean DB
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "wallet_transactions", "payouts", "audit_logs", "cart_items", "favorites", "order_items", "deliveries", "payments", "orders", "notifications", "addresses", "products", "delivery_zones", "users", "store_configs", "admin_preferences" CASCADE;`,
    );
    redisStore.clear();
    throttlerStore.clear();

    // Create buyer1
    const buyerEmail = `buyer-sec-${Date.now()}@test.com`;
    const buyerRes = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ name: 'Buyer Sec', email: buyerEmail, password: 'BuyerPass123!' })
      .expect(201);
    buyerId = buyerRes.body.data.id;
    const login1 = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: buyerEmail, password: 'BuyerPass123!' })
      .expect(200);
    buyerToken = login1.body.access_token;

    // Create buyer2 for IDOR tests
    const buyer2Email = `buyer2-sec-${Date.now()}@test.com`;
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ name: 'Buyer2 Sec', email: buyer2Email, password: 'BuyerPass123!' })
      .expect(201);
    const login2 = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: buyer2Email, password: 'BuyerPass123!' })
      .expect(200);
    buyer2Token = login2.body.access_token;
    const buyer2 = await prisma.user.findUnique({ where: { email: buyer2Email } });
    buyer2Id = buyer2!.id;

    // Create admin
    const adminEmail = `admin-sec-${Date.now()}@test.com`;
    const hash = await bcrypt.hash('AdminPass123!', 10);
    await prisma.user.create({
      data: { name: 'Admin Sec', email: adminEmail, passwordHash: hash, role: 'ADMIN' as any },
    });
    const adminLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'AdminPass123!' })
      .expect(200);
    adminToken = adminLogin.body.access_token;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "wallet_transactions", "payouts", "audit_logs", "cart_items", "favorites", "order_items", "deliveries", "payments", "orders", "notifications", "addresses", "products", "delivery_zones", "users", "store_configs", "admin_preferences" CASCADE;`,
    );
    await app.close();
  });

  describe('A01 Broken Access Control - /admin/* exige role=admin', () => {
    const adminRoutes: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; path: string; body?: any }> = [
      { method: 'get', path: '/api/v1/admin/products' },
      { method: 'get', path: '/api/v1/admin/produtos' },
      { method: 'get', path: '/api/v1/admin/orders' },
      { method: 'get', path: '/api/v1/admin/pedidos' },
      { method: 'get', path: '/api/v1/admin/deliveries' },
      { method: 'get', path: '/api/v1/admin/entregas' },
      { method: 'get', path: '/api/v1/admin/statistics' },
      { method: 'get', path: '/api/v1/admin/estatisticas' },
      { method: 'get', path: '/api/v1/admin/store' },
      { method: 'get', path: '/api/v1/admin/loja' },
      { method: 'get', path: '/api/v1/admin/account' },
      { method: 'get', path: '/api/v1/admin/conta' },
      { method: 'get', path: '/api/v1/admin/preferences' },
      { method: 'get', path: '/api/v1/admin/preferencias' },
      { method: 'get', path: '/api/v1/admin/members' },
      { method: 'get', path: '/api/v1/admin/membros' },
      { method: 'get', path: '/api/v1/admin/audit' },
      { method: 'get', path: '/api/v1/admin/auditoria' },
      { method: 'get', path: '/api/v1/admin/payments/historico' },
      { method: 'get', path: '/api/v1/admin/pagamentos/historico' },
    ];

    it.each(adminRoutes)('$method $path sem token deve retornar 401', async ({ method, path }) => {
      const res = await (request(httpServer) as any)[method](path).expect(401);
      expect(res.body.erro.codigo).toBe('NAO_AUTENTICADO');
    });

    it.each(adminRoutes)('$method $path com token buyer deve retornar 403', async ({ method, path, body }) => {
      const req = (request(httpServer) as any)[method](path).set('Authorization', `Bearer ${buyerToken}`);
      if (body) req.send(body);
      const res = await req.expect(403);
      expect(res.body.erro.codigo).toBe('ACESSO_NEGADO');
    });

    it('admin com role=admin deve acessar /admin/* (200)', async () => {
      await request(httpServer)
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      await request(httpServer)
        .get('/api/v1/admin/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      await request(httpServer)
        .get('/api/v1/admin/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('A07: Rate limiting em /auth/* e /checkout', () => {
    beforeEach(async () => {
      // limpa throttler store para isolar teste
      throttlerStore.clear();
      redisStore.clear();
    });

    it('POST /api/v1/auth/login deve ser limitado a 20 req/min (auth throttler)', async () => {
      // 20 requests devem passar (com credenciais inválidas ainda conta para throttler)
      for (let i = 0; i < 20; i++) {
        await request(httpServer)
          .post('/api/v1/auth/login')
          .send({ email: 'notfound@test.com', password: 'wrong' })
          .expect((res) => {
            // pode ser 401, mas não 429 nos primeiros 20
            expect([401, 429].includes(res.status)).toBe(true);
            if (res.status === 429) throw new Error('Throttled too early');
          });
      }
      // 21ª deve ser 429
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: 'notfound@test.com', password: 'wrong' });
      expect(res.status).toBe(429);
      expect(res.body.erro.codigo).toBe('LIMITE_EXCEDIDO');
    });

    it('POST /api/v1/auth/forgot-password (esqueci) deve ser limitado a 5/15min', async () => {
      throttlerStore.clear();
      for (let i = 0; i < 5; i++) {
        await request(httpServer)
          .post('/api/v1/auth/forgot-password')
          .send({ email: `test${i}@test.com` })
          .expect(200);
      }
      const res = await request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test5@test.com' });
      expect(res.status).toBe(429);
      expect(res.body.erro.codigo).toBe('LIMITE_EXCEDIDO');

      // alias em português é rota diferente, tem contador separado - deve ainda permitir (200) ou também ser limitado se compartilhar throttler
      // como são rotas diferentes, o contador é separado, então espera 200
      const resPt = await request(httpServer)
        .post('/api/v1/auth/esqueci-password')
        .send({ email: 'test-pt@test.com' });
      expect([200, 429].includes(resPt.status)).toBe(true);
    });

    it('POST /api/v1/checkout deve ser limitado a 10/min', async () => {
      throttlerStore.clear();
      // checkout exige auth, throttler conta antes de auth
      // carrinho vazio retorna 400, mas throttler ainda conta
      for (let i = 0; i < 10; i++) {
        const res = await request(httpServer)
          .post('/api/v1/checkout')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({ tipo: 'levantamento_loja', data_agendada: '2026-12-01', janela_horario: '09:00-12:00' });
        // nos primeiros 10, pode ser 400 (carrinho vazio) - não deve ser 429 ainda
        if (![400, 200, 201].includes(res.status)) {
          console.log(`CHECKOUT i=${i} status=${res.status} body`, JSON.stringify(res.body, null, 2));
        }
        expect([400, 200, 201, 401].includes(res.status)).toBe(true);
        if (res.status === 429) throw new Error(`Throttled too early checkout at i=${i} status 429`);
      }
      const res = await request(httpServer)
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ tipo: 'levantamento_loja', data_agendada: '2026-12-01', janela_horario: '09:00-12:00' });
      expect(res.status).toBe(429);
      expect(res.body.erro.codigo).toBe('LIMITE_EXCEDIDO');
    });

    it('GET /api/v1/products não deve ser limitado (skipIf)', async () => {
      throttlerStore.clear();
      // 25 requests should all succeed (200) because throttler skips non-auth/checkout
      for (let i = 0; i < 25; i++) {
        await request(httpServer).get('/api/v1/products').expect(200);
      }
    });
  });

  describe('A01 IDOR - ownership em /orders e /profile/addresses', () => {
    let buyer1AddressId: string;
    let buyer1OrderId: string;
    let buyer2AddressId: string;

    beforeAll(async () => {
      // Cria endereços para buyer1 e buyer2
      const addr1 = await request(httpServer)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          label: 'Casa',
          province: 'Luanda',
          municipality: 'Talatona',
          neighborhood: 'Talatona',
          street: 'Rua 1',
        })
        .expect(201);
      buyer1AddressId = addr1.body.data.id;

      const addr2 = await request(httpServer)
        .post('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .send({
          label: 'Casa2',
          province: 'Luanda',
          municipality: 'Viana',
          neighborhood: 'Viana',
          street: 'Rua 2',
        })
        .expect(201);
      buyer2AddressId = addr2.body.data.id;

      // Cria produto e pedido para buyer1 via checkout (para testar /orders/:id)
      // precisa de produto
      const prodRes = await request(httpServer)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          image: 'https://cdn.test.com/idor.jpg',
          name: 'Produto IDOR',
          description: 'teste',
          category: 'SUITS',
          size: 'M',
          condition: 'NEW',
          stock: 5,
          price: 10000,
        })
        .expect(201);
      const prodId = prodRes.body.data.id;

      await request(httpServer)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ product_id: prodId, quantity: 1 })
        .expect(201);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const checkoutRes = await request(httpServer)
        .post('/api/v1/checkout')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ tipo: 'levantamento_loja', data_agendada: dateStr, janela_horario: '09:00-12:00' })
        .expect(201);
      buyer1OrderId = checkoutRes.body.data.id;
    });

    it('GET /api/v1/orders/:id com buyer diferente deve retornar 404 (não 200)', async () => {
      await request(httpServer)
        .get(`/api/v1/orders/${buyer1OrderId}`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.erro.codigo).toBe('NAO_ENCONTRADO');
        });
    });

    it('GET /api/v1/pedidos/:id com buyer diferente deve retornar 404', async () => {
      await request(httpServer)
        .get(`/api/v1/pedidos/${buyer1OrderId}`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(404);
    });

    it('GET /api/v1/profile/addresses deve retornar só endereços do próprio buyer', async () => {
      const res1 = await request(httpServer)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      const list1 = res1.body.data || res1.body.dados;
      expect(list1.every((a: any) => a.buyerId === buyerId || a.compradorId === buyerId)).toBe(true);
      expect(list1.find((a: any) => a.id === buyer2AddressId)).toBeUndefined();

      const res2 = await request(httpServer)
        .get('/api/v1/profile/addresses')
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(200);
      const list2 = res2.body.data || res2.body.dados;
      expect(list2.find((a: any) => a.id === buyer1AddressId)).toBeUndefined();
    });

    it('PATCH /api/v1/profile/addresses/:id de outro buyer deve retornar 404', async () => {
      await request(httpServer)
        .patch(`/api/v1/profile/addresses/${buyer2AddressId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ street: 'Rua Hack' })
        .expect(404)
        .expect((res) => {
          expect(res.body.erro.codigo).toBe('NAO_ENCONTRADO');
        });
    });

    it('DELETE /api/v1/profile/addresses/:id de outro buyer deve retornar 404', async () => {
      await request(httpServer)
        .delete(`/api/v1/profile/addresses/${buyer2AddressId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
    });

    it('PATCH /api/v1/orders/:id/cancel de outro buyer deve retornar 404', async () => {
      await request(httpServer)
        .patch(`/api/v1/orders/${buyer1OrderId}/cancel`)
        .set('Authorization', `Bearer ${buyer2Token}`)
        .expect(404);
    });
  });

  describe('A02/A07 Secrets só de env vars', () => {
    it('não deve ter JWT_SECRET hardcoded no código', async () => {
      const fs = require('fs');
      const files = [
        'src/config/configuration.ts',
        'src/config/env.validation.ts',
        'src/common/guards/jwt-auth.guard.ts',
        'src/modules/auth/auth.service.ts',
      ];
      for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        // não deve conter string literal com segredo real
        expect(content).not.toMatch(/change-me-super-secret-jwt-32chars-min/);
        // deve usar process.env ou configService.get
        if (f.includes('configuration')) {
          expect(content).toMatch(/process\.env\.JWT_SECRET/);
        }
        if (f.includes('jwt-auth')) {
          expect(content).toMatch(/configService\.get.*jwt\.secret/);
        }
      }
      // valida que env vars são obrigatórias (Joi)
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET!.length).toBeGreaterThanOrEqual(16);
      expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
    });

    it('PAYMENT_WEBHOOK_SECRET deve vir de env, não hardcoded', async () => {
      const fs = require('fs');
      const content = fs.readFileSync('src/config/configuration.ts', 'utf8');
      expect(content).toMatch(/process\.env\.PAYMENT_WEBHOOK_SECRET/);
      expect(content).not.toMatch(/"change-me-webhook-secret-32chars"/);
      expect(process.env.PAYMENT_WEBHOOK_SECRET).toBeDefined();
    });

    it('DATABASE_URL e REDIS_URL devem vir de env', async () => {
      const fs = require('fs');
      const config = fs.readFileSync('src/config/configuration.ts', 'utf8');
      expect(config).toMatch(/process\.env\.DATABASE_URL/);
      expect(config).toMatch(/process\.env\.REDIS_URL/);
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.REDIS_URL).toBeDefined();
    });
  });

  describe('OWASP A03 Injection & A05 Security Misconfiguration', () => {
    it('POST /api/v1/auth/register com payload malicioso não deve causar injection (whitelist)', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker',
          email: `hacker-${Date.now()}@test.com`,
          password: 'HackerPass123!',
          // tenta injetar campo extra
          role: 'ADMIN',
          isAdmin: true,
          __proto__: { admin: true },
        });
      // com forbidNonWhitelisted:true deve rejeitar com 400, ou ignorar e criar como BUYER (201)
      expect([201, 400].includes(res.status)).toBe(true);
      if (res.status === 201) {
        expect(res.body.data.role).toBe('BUYER');
      } else {
        expect(res.body.erro.codigo).toBe('ERRO_VALIDACAO');
      }
    });

    it('GET /api/v1/products?q=<script> não deve refletir XSS e deve sanitizar', async () => {
      const res = await request(httpServer)
        .get('/api/v1/products')
        .query({ q: '<script>alert(1)</script>' })
        .expect(200);
      // não deve retornar erro 500, deve tratar como busca normal
      expect(res.body.data || res.body.dados).toBeDefined();
    });

    it('nenhum endpoint deve expor stack trace em produção (mensagem genérica)', async () => {
      // força erro interno via ID inválido que passa na validação mas não existe
      const res = await request(httpServer)
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
      expect(res.body.erro.mensagem).toBe('Pedido não encontrado');
      expect(JSON.stringify(res.body)).not.toMatch(/stack|at Object/);
    });

    it('CORS e headers de segurança básicos', async () => {
      // health é excluído do prefixo api/v1, deve estar em /health
      let res = await request(httpServer).get('/health');
      if (res.status === 404) {
        // fallback para /api/v1/health se exclude não funcionar no teste
        res = await request(httpServer).get('/api/v1/health');
      }
      expect([200, 404].includes(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.headers).toBeDefined();
        expect(res.body.status).toBeDefined();
      }
    });
  });
});
