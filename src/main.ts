import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

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

  // Swagger em /api/docs (sem prefixo /api/v1)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SadivaCloset API')
    .setDescription('API SadivaCloset - NestJS + Prisma + Postgres + Redis')
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
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
  const port =
    configService.get<number>('port') ??
    parseInt(configService.get<string>('PORT') ?? '', 10) ??
    3001;

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 SadivaCloset API a correr em http://localhost:${port}`);
  logger.log(`   Health: http://localhost:${port}/health`);
  logger.log(`   Docs:   http://localhost:${port}/api/docs`);
}
bootstrap().catch((err) => {
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
