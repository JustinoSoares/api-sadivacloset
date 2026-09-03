import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';
import { v4 as uuidv4 } from 'uuid';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { DeliveryZonesModule } from './modules/delivery-zones/delivery-zones.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { CartModule } from './modules/cart/cart.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { QueueModule } from './modules/queue/queue.module';
import { MailModule } from './modules/mail/mail.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      expandVariables: true,
    }),
    PrismaModule,
    RedisModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genReqId: (req: any) => {
          const h = (req.headers ?? {}) as Record<string, string | undefined>;
          const existing = h['x-request-id'] ?? h['x-correlation-id'];
          return (existing as string) ?? uuidv4();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customProps: (req: any) => ({
          requestId: (req as Record<string, unknown>).id,
        }),
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        autoLogging: true,
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: ['REDIS_CLIENT'],
      useFactory: (redis: import('ioredis').default) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 60 },
          { name: 'auth', ttl: 60_000, limit: 20 },
          { name: 'esqueci', ttl: 15 * 60 * 1000, limit: 5 },
          { name: 'checkout', ttl: 60_000, limit: 10 },
        ],
        storage: new RedisThrottlerStorage(redis as unknown as import('ioredis').default),
        // Default message goes through HttpExceptionFilter -> { error: { code: 'RATE_LIMIT_EXCEEDED' } }
        errorMessage: 'Too many requests. Please try again later.',
        // Só aplica throttling a /auth/* e /checkout — outras rotas (perfil, produtos, health, docs) ficam sem limite
        skipIf: (ctx) => {
          try {
            const req = ctx.switchToHttp().getRequest<{ url?: string; originalUrl?: string }>();
            const url: string = (req?.originalUrl ?? req?.url ?? '') as string;
            return !url.includes('/auth') && !url.includes('/checkout');
          } catch {
            return true;
          }
        },
      }),
    }),
    JwtModule.register({}),
    MailModule,
    AuthModule,
    AdminModule,
    ProductsModule,
    CategoriesModule,
    DeliveryZonesModule,
    FavoritesModule,
    CartModule,
    NotificationsModule,
    AddressesModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    StorageModule,
    AuditModule,
    AuditoriaModule,
    QueueModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    // Ordem: Throttler primeiro (bloqueia antes de auth), depois auth, depois roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
