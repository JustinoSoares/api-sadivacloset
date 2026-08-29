import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string()
    .uri()
    .required()
    .description(
      'Postgres connection string, ex: postgresql://user:pass@postgres:5432/db?schema=public',
    ),
  REDIS_URL: Joi.string()
    .uri()
    .required()
    .description('Redis connection string, ex: redis://redis:6379'),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m')
    .description('Ex: 15m, 1h, 7d'),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),

  POSTGRES_USER: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().optional(),
  POSTGRES_DB: Joi.string().optional(),

  BRIDPAY_BASE_URL: Joi.string().uri().optional().default('http://localhost:3000'),
  BRIDPAY_API_KEY: Joi.string().allow('').optional().default(''),
  BRIDPAY_ENVIRONMENT: Joi.string().valid('live', 'sandbox').optional().default('sandbox'),

  // AppPay – provider real da BridPay (GPO / GPR)
  APPYPAY_ENVIRONMENT: Joi.string().valid('live', 'sandbox').optional().default('sandbox'),
  APPYPAY_AUTH_URL: Joi.string().uri().optional().default('https://login.microsoftonline.com/{tenant}/oauth2/token'),
  APPYPAY_TENANT: Joi.string().allow('').optional().default(''),
  APPYPAY_CLIENT_ID: Joi.string().allow('').optional().default(''),
  APPYPAY_CLIENT_SECRET: Joi.string().allow('').optional().default(''),
  APPYPAY_RESOURCE: Joi.string().allow('').optional().default(''),
  APPYPAY_API_BASE_URL: Joi.string().uri().optional().default('https://gwy-api.appypay.co.ao'),
  APPYPAY_MERCHANT_IDENTIFIER: Joi.string().allow('').optional().default(''),
  APPYPAY_OPTIONS_API_KEY: Joi.string().allow('').optional().default(''),
  APPYPAY_PAYMENT_METHOD_GPO: Joi.string().allow('').optional().default(''),
  APPYPAY_PAYMENT_METHOD_REFERENCE: Joi.string().allow('').optional().default(''),
  APPYPAY_WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  APPYPAY_HTTP_TIMEOUT_MS: Joi.number().positive().optional().default(10000),

  // E-Kwanza – provider real da BridPay (KWiK / Ticket)
  EKWANZA_API_BASE_URL: Joi.string().uri().optional().default('https://api.e-kwanza.co.ao'),
  EKWANZA_NOTIFICATION_TOKEN: Joi.string().allow('').optional().default(''),
  EKWANZA_API_KEY: Joi.string().allow('').optional().default(''),
  EKWANZA_MERCHANT_REGISTRATION_NUMBER: Joi.string().allow('').optional().default(''),
  EKWANZA_HTTP_TIMEOUT_MS: Joi.number().positive().optional().default(10000),

  UPLOAD_DIR: Joi.string().optional().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: Joi.number().positive().optional().default(5),

  PAYMENT_WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_APPYPAY: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_EKWANZA: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_GENERIC: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_BRIDPAY: Joi.string().allow('').optional().default(''),
  WEBHOOK_PAYMENT_SECRET: Joi.string().allow('').optional().default(''),
  WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  PAYMENT_QUEUE_NAME: Joi.string().optional().default('pagamento-confirmado'),
});
