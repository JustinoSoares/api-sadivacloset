import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validação global — DTOs com class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS liberado em dev; restrinja em produção via env
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Prefixo global opcional — descomente se quiser versionar: /api/v1
  // app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  // ConfigModule carrega via `configuration.ts` -> `port` (number) e `PORT` (raw string).
  // Suporta ambos para compatibilidade; valida que é número.
  const port =
    configService.get<number>('port') ??
    parseInt(configService.get<string>('PORT') ?? '', 10) ??
    3001;

  // Host 0.0.0.0 garante escuta dentro do Docker e no host
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 SadivaCloset API a correr em http://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
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
