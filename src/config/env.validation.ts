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
});
