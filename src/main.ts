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
  // Erros sempre com formato previsível { message: string } via HttpExceptionFilter
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => {
            const constraints = Object.values(e.constraints ?? {});
            if (constraints.length > 0) return `${e.property}: ${constraints.join(', ')}`;
            return `${e.property}: valor inválido`;
          })
          .join('; ');
        throw new BadRequestException(messages || 'Dados inválidos. Verifique os campos e tente novamente.');
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

  // CORS via variável de ambiente CORS_ALLOWED_ORIGINS
  // Dev: vazio = libera tudo (origin:true). Produção: lista explícita obrigatória (validada em env.validation.ts)
  const configService = app.get(ConfigService);
  const corsConfig = configService.get<{ allowedOrigins: string[]; allowAll: boolean }>('cors')!;
  const nodeEnv = configService.get<string>('nodeEnv') ?? process.env.NODE_ENV;

  if (corsConfig.allowAll) {
    // Dev/test com CORS liberado — permite qualquer origem
    if (nodeEnv === 'production') {
      // Fallback de segurança: não deveria chegar aqui (validateEnv barra), mas garante
      app.enableCors({
        origin: false,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'x-request-id',
          'x-correlation-id',
          'x-signature',
          'x-webhook-signature',
          'signature',
          'x-hub-signature',
        ],
      });
    } else {
      app.enableCors({
        origin: true,
        credentials: true,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'x-request-id',
          'x-correlation-id',
          'x-signature',
          'x-webhook-signature',
          'signature',
          'x-hub-signature',
        ],
      });
    }
  } else {
    const allowedOrigins = corsConfig.allowedOrigins;
    app.enableCors({
      origin: (origin, callback) => {
        // Requests sem Origin (curl, Postman, mobile, server-to-server) → permite
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Bloqueia origem não listada — não retorna header CORS (browser bloqueia)
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-request-id',
        'x-correlation-id',
        'x-signature',
        'x-webhook-signature',
        'signature',
        'x-hub-signature',
      ],
      exposedHeaders: ['X-Request-Id'],
    });
  }

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
# SadivaCloset API – Frontend Contract

**Base URL:** https://api-sadivacloset.himersus.com/api/v1 (staging) | Local: http://localhost:3001/api/v1 | Docs: /api/docs | OpenAPI JSON: /api/docs-json

**Language:** All code, tables, endpoints and responses are in English. Error format is { message: string } — always top-level message (predictable).

## Authentication
- JWT Bearer (Authorization: Bearer <access_token>).
- POST /auth/register -> creates BUYER, POST /auth/login -> { access_token, refresh_token }, POST /auth/refresh, POST /auth/logout.
- Public routes marked with @Public(): auth/*, products, categories, delivery-zones, health, webhooks/*.
- All other routes require JWT; /admin/* requires role=admin (global guard + @Roles('admin')).

## Pagination
- Query: ?page=1&limit=20 (PaginationDto).
- Response: { data, page, total, totalPages }.

## Errors
\`\`\`json
{ "message": "Validation failed: email: must be a valid email; password: too short" }
\`\`\`
- All errors return { message: string } with appropriate HTTP status. Frontend reads response.data.message only.
- 400 Validation, 401 Unauthenticated, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Rate limit, 500 Internal.

## CORS
- Controlled by env var CORS_ALLOWED_ORIGINS (comma-separated). Dev: empty → allow all (origin:true). Prod: required explicit list, e.g. CORS_ALLOWED_ORIGINS=https://sadivacloset.co.ao,https://www.sadivacloset.co.ao,https://api-sadivacloset.himersus.com
- Alias CORS_ORIGIN also accepted.

## Rate Limiting (Redis)
- auth 20/min, forgot 5/15min (POST /auth/forgot-password), checkout 10/min, default 60/min. Response 429 { message: "Too many requests. Please try again later." }.

## Webhooks
- POST /webhooks/payment/:gateway (public, HMAC x-signature = HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET), idempotent by externalReference).

## Receipts
- POST /orders/:id/payment/receipt expects JSON { receiptUrl: "https://..." } (frontend hosts file externally, e.g. S3/Cloudinary). No multipart upload.

See tags below for critical flows: Auth -> Products -> Cart -> Checkout -> Orders -> Payments/Webhooks -> Admin.
      `.trim(),
    )
    .setVersion('0.1.0')
    .setContact(
      'SadivaCloset Team',
      'https://github.com/sadivacloset',
      'contacto@sadivacloset.co.ao',
    )
    .setLicense('Proprietary', 'https://sadivacloset.co.ao/terms')
    .addServer('https://api-sadivacloset.himersus.com', 'Staging')
    .addServer('http://localhost:3001', 'Local (Docker host)')
    .addServer('http://localhost:3002', 'Local alt (host .env PORT=3002)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste access_token from POST /auth/login',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-signature',
        description: 'HMAC SHA256 of rawBody with PAYMENT_WEBHOOK_SECRET (webhooks only)',
      },
      'x-signature',
    )
    .addTag('auth', 'Register, login, refresh, forgot/reset, profile')
    .addTag('products', 'Public catalog (cache 60s, filters, sorting)')
    .addTag('categories', 'Categories')
    .addTag('delivery-zones', 'Delivery zones')
    .addTag('cart', 'Cart (validates stock)')
    .addTag('checkout', 'Create order from cart (transaction)')
    .addTag('orders', 'Buyer orders')
    .addTag('profile/orders', 'Profile order history')
    .addTag('profile/addresses', 'Buyer addresses')
    .addTag('payments', 'Payments, wallet, receipts')
    .addTag('webhooks', 'Payment webhooks (public, HMAC, idempotent)')
    .addTag('favorites', 'Favorites')
    .addTag('notifications', 'Notifications')
    .addTag('admin-products', 'Admin: products CRUD')
    .addTag('admin-orders', 'Admin: orders management')
    .addTag('admin-deliveries', 'Admin: deliveries')
    .addTag('admin-statistics', 'Admin: statistics dashboard')
    .addTag('admin-store', 'Admin: store config')
    .addTag('admin-account', 'Admin: account')
    .addTag('admin-preferences', 'Admin: preferences')
    .addTag('admin-members', 'Admin: members')
    .addTag('admin-audit', 'Admin: audit logs')
    .addTag('admin-payments', 'Admin: payment validation')
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
        `Tens o Docker a correr (sadivacloset-api:3001) ou outro processo.\n` +
        `   → Opções: 1) docker compose down  2) muda PORT no .env (ex: 3002)  3) PORT=3002 pnpm run start:dev  4) lsof -i :${err.port} / ss -tulpn | grep ${err.port}`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
