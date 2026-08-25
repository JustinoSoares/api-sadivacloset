import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // ConfigModule global com validação Joi — falha fast se faltar env var obrigatória
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      expandVariables: true,
    }),
    // Rate limiting global — store em memória por defeito;
    // em produção trocar por ThrottlerStorageRedis (ioredis) — ver docs do @nestjs/throttler
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 60s
        limit: 60,   // 60 req/min por IP
      },
    ]),
    PrismaModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
