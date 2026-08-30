import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  // OWASP A05: Security headers via helmet
  app.use(helmet());
  // Hide X-Powered-By (helmet does, but explicit)
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // Validação global — DTOs com class-validator
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
          erro: {
            codigo: 'ERRO_VALIDACAO',
            mensagem: 'Erro de validação',
            detalhes,
          },
        });
      },
    }),
  );

  // Captura rawBody para validação HMAC de webhooks (x-signature)
  // Deve vir antes de qualquer body parser
  app.use(
    express.json({
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
      limit: '2mb',
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  // CORS liberado em dev; restrinja em produção via env
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Serve comprovativos e uploads
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.use('/api/v1/uploads', express.static(join(process.cwd(), 'uploads')));

  // Prefixo global /api/v1 em toda a aplicação, exceto health e docs
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { method: RequestMethod.GET, path: '' },
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'api/docs' },
      { method: RequestMethod.GET, path: 'api/docs-json' },
      { method: RequestMethod.GET, path: 'api/docs/(.*)' },
    ],
  });

  // Swagger em /api/docs (sem prefixo /api/v1) – contrato definitivo para frontend
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SadivaCloset API')
    .setDescription(
      `
# SadivaCloset API – Contrato Frontend

**Base URL:** http://localhost:3001/api/v1 (prefixo global) | Docs: /api/docs | OpenAPI JSON: /api/docs-json

**Idioma:** Codigo, tabelas e endpoints em Ingles; mensagens de erro/validacao para o utilizador em Portugues ({ erro: { codigo, mensagem, detalhes } }).

## Autenticacao
- JWT Bearer (Authorization: Bearer <access_token>).
- POST /auth/register -> cria BUYER, POST /auth/login -> { access_token, refresh_token }, POST /auth/refresh, POST /auth/logout.
- Rotas publicas marcadas com @Public(): auth/*, products, categories, delivery-zones, health, webhooks/*.
- Todas as outras exigem JWT; /admin/* exige role=admin (guard global + @Roles('admin')).

## Paginacao bilingue
- Query: ?page=1&limit=20 (PaginationDto).
- Resposta: { data, dados, page, pagina, total, totalPages, total_paginas } – use data/page/totalPages (EN) ou dados/pagina/total_paginas (PT).

## Erros
\`\`\`json
{ "erro": { "codigo": "ERRO_VALIDACAO|NAO_AUTENTICADO|ACESSO_NEGADO|NAO_ENCONTRADO|STOCK_INSUFICIENTE|LIMITE_EXCEDIDO|ERRO_INTERNO", "mensagem": "...", "detalhes": [...] } }
\`\`\`
- 400 PEDIDO_INVALIDO/ERRO_VALIDACAO, 401 NAO_AUTENTICADO, 403 ACESSO_NEGADO, 404 NAO_ENCONTRADO, 409 CONFLITO/EMAIL_JA_EXISTE, 429 LIMITE_EXCEDIDO, 500 ERRO_INTERNO.

## Rate Limiting (Redis)
- auth 20/min, esqueci 5/15min (POST /auth/forgot-password, /auth/esqueci-password), checkout 10/min, default 60/min. Resposta 429 { erro: { codigo: LIMITE_EXCEDIDO } }.

## Webhooks
- POST /webhooks/payment/:gateway (publico, HMAC x-signature = HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET), idempotente por referencia_externa).

## Uploads
- POST /orders/:id/payment/receipt multipart file, servido em /uploads e /api/v1/uploads.

Veja tags abaixo para fluxos criticos: Auth -> Products -> Cart -> Checkout -> Orders -> Payments/Webhooks -> Admin.
      `.trim(),
    )
    .setVersion('0.1.0')
    .setContact(
      'SadivaCloset Team',
      'https://github.com/sadivacloset',
      'contacto@sadivacloset.co.ao',
    )
    .setLicense('Proprietary', 'https://sadivacloset.co.ao/terms')
    .addServer('http://localhost:3001', 'Local (Docker host)')
    .addServer('http://localhost:3002', 'Local alt (host .env PORT=3002)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Colar access_token obtido em POST /auth/login',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-signature',
        description: 'HMAC SHA256 do rawBody com PAYMENT_WEBHOOK_SECRET (apenas webhooks)',
      },
      'x-signature',
    )
    .addTag('auth', 'Registo, login, refresh, forgot/reset, perfil')
    .addTag('products', 'Catálogo público (cache 60s, filtros, ordenação)')
    .addTag('categories', 'Categorias')
    .addTag('delivery-zones', 'Zonas de entrega')
    .addTag('cart', 'Carrinho (valida stock)')
    .addTag('checkout', 'Cria pedido a partir do carrinho (transação)')
    .addTag('orders', 'Pedidos do comprador')
    .addTag('profile/orders', 'Histórico do perfil')
    .addTag('profile/addresses', 'Endereços do comprador')
    .addTag('payments', 'Pagamentos, carteira, comprovativos')
    .addTag('webhooks', 'Webhooks de pagamento (público, HMAC, idempotente)')
    .addTag('favorites', 'Favoritos')
    .addTag('notifications', 'Notificações')
    .addTag('admin-products', 'Admin: CRUD produtos')
    .addTag('admin-orders', 'Admin: gestão pedidos')
    .addTag('admin-deliveries', 'Admin: entregas')
    .addTag('admin-statistics', 'Admin: dashboard estatísticas')
    .addTag('admin-store', 'Admin: loja')
    .addTag('admin-account', 'Admin: conta')
    .addTag('admin-preferences', 'Admin: preferências')
    .addTag('admin-members', 'Admin: membros')
    .addTag('admin-audit', 'Admin: auditoria')
    .addTag('admin-payments', 'Admin: validação pagamentos')
    .addTag('health', 'Healthcheck')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: false,
  });
  // document já considera global prefix, mas queremos docs em /api/docs sem prefixo extra
  // Como setGlobalPrefix exclui /api/docs, o documento fica disponível em /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'SadivaCloset API Docs',
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('port');

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 SadivaCloset API a correr em http://localhost:${port}`);
  logger.log(`   Health: http://localhost:${port}/health`);
  logger.log(`   Docs:   http://localhost:${port}/api/docs`);
}
bootstrap().catch((err) => {
  // Erro de validação de .env já vem formatado pelo validateEnv
  if (
    err?.message?.includes('variáveis de ambiente') ||
    err?.message?.includes('variaveis de ambiente')
  ) {
    console.error(err.message);
    process.exit(1);
  }
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `❌ Porta ${err.port} já em uso (EADDRINUSE). ` +
        `Tens o Docker a correr (sadivacloset-api:3001 + bridpay-api:3000) ou outro processo.\n` +
        `   → Opções: 1) docker compose down  2) muda PORT no .env (ex: 3002)  3) PORT=3002 pnpm run start:dev  4) lsof -i :${err.port} / ss -tulpn | grep ${err.port}`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
