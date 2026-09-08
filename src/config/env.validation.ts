import * as Joi from 'joi';

/**
 * Schema Joi para validação de variáveis de ambiente.
 * - Falha no boot (fail-fast) se faltar variável obrigatória.
 * - Em produção exige secrets fortes (>=32 chars) e PAYMENT_WEBHOOK_SECRET.
 * - Mensagens em PT para facilitar correção via .env / .env.example
 * - Gateway único: E-Kwanza (KWiK / Ticket)
 */
export const envValidationSchema = Joi.object({
  // ── APP ──
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .description('Ambiente de execução'),

  PORT: Joi.number().port().default(3001).description('Porta HTTP da API'),

  // ── DATABASE ──
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required()
    .messages({
      'any.required':
        '"DATABASE_URL" é obrigatória. Ex: postgresql://user:pass@postgres:5432/db?schema=public',
      'string.uri':
        '"DATABASE_URL" deve ser uma URI PostgreSQL válida (ex: postgresql://user:pass@host:5432/db)',
      'string.empty': '"DATABASE_URL" não pode estar vazia',
    }),

  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required()
    .messages({
      'any.required': '"REDIS_URL" é obrigatória. Ex: redis://redis:6379 ou redis://localhost:6381',
      'string.uri': '"REDIS_URL" deve ser uma URI Redis válida (ex: redis://redis:6379)',
      'string.empty': '"REDIS_URL" não pode estar vazia',
    }),

  // Docker-compose helpers (opcionais, usados só pelo container postgres)
  POSTGRES_USER: Joi.string().optional().allow(''),
  POSTGRES_PASSWORD: Joi.string().optional().allow(''),
  POSTGRES_DB: Joi.string().optional().allow(''),

  // ── AUTH ──
  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required':
      '"JWT_SECRET" é obrigatória (mín. 16 chars, 32+ em produção). Gere com: openssl rand -base64 32',
    'string.min':
      '"JWT_SECRET" deve ter pelo menos {#limit} caracteres. Gere com: openssl rand -base64 32',
    'string.empty': '"JWT_SECRET" não pode estar vazia',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(16).required().messages({
    'any.required':
      '"JWT_REFRESH_SECRET" é obrigatória (mín. 16 chars, 32+ em produção). Gere com: openssl rand -base64 32',
    'string.min': '"JWT_REFRESH_SECRET" deve ter pelo menos {#limit} caracteres',
    'string.empty': '"JWT_REFRESH_SECRET" não pode estar vazia',
  }),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m')
    .messages({ 'string.pattern.base': '"JWT_EXPIRES_IN" deve ser no formato 15m, 1h, 7d, 30s' }),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d')
    .messages({
      'string.pattern.base': '"JWT_REFRESH_EXPIRES_IN" deve ser no formato 15m, 1h, 7d',
    }),

  // ── E-KWANZA (único gateway legado) ──
  EKWANZA_API_BASE_URL: Joi.string()
    .uri()
    .optional()
    .default('https://api.e-kwanza.co.ao')
    .allow(''),
  EKWANZA_URL_KWIK: Joi.string().uri().optional().allow('').default(''),
  EKWANZA_NOTIFICATION_TOKEN: Joi.string().allow('').optional().default(''),
  EKWANZA_API_KEY: Joi.string().allow('').optional().default(''),
  EKWANZA_MERCHANT_REGISTRATION_NUMBER: Joi.string().allow('').optional().default(''),
  EKWANZA_HTTP_TIMEOUT_MS: Joi.number().positive().optional().default(10000),

  // ── APPYPAY (GPO – Multicaixa Express / GPR – Referência) ──
  APPYPAY_ENVIRONMENT: Joi.string().valid('sandbox', 'production', 'sandbox', 'prod').allow('').optional().default('sandbox'),
  APPYPAY_AUTH_URL: Joi.string().uri().allow('').optional().default(''),
  APPYPAY_TENANT: Joi.string().allow('').optional().default(''),
  APPYPAY_CLIENT_ID: Joi.string().allow('').optional().default(''),
  APPYPAY_CLIENT_SECRET: Joi.string().allow('').optional().default(''),
  APPYPAY_RESOURCE: Joi.string().allow('').optional().default(''),
  APPYPAY_API_BASE_URL: Joi.string().uri().allow('').optional().default(''),
  APPYPAY_MERCHANT_IDENTIFIER: Joi.string().allow('').optional().default(''),
  APPYPAY_OPTIONS_API_KEY: Joi.string().allow('').optional().default(''),
  APPYPAY_PAYMENT_METHOD_REFERENCE: Joi.string().allow('').optional().default(''),
  APPYPAY_PAYMENT_METHOD_GPO: Joi.string().allow('').optional().default(''),
  APPYPAY_WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  APPYPAY_HTTP_TIMEOUT_MS: Joi.number().positive().optional().default(60000),
  APPYPAY_CODE_REF: Joi.string().allow('').optional().default('10111'),

  // ── CORS ──
  // Lista de origens permitidas separadas por vírgula, ex: https://app.com,https://admin.app.com
  // Em dev pode ficar vazio (libera tudo); em produção é obrigatório e não pode ser "*"
  CORS_ALLOWED_ORIGINS: Joi.string().allow('').optional().default(''),
  // Alias legado — se definido e CORS_ALLOWED_ORIGINS vazio, será copiado
  CORS_ORIGIN: Joi.string().allow('').optional().default(''),

  // ── UPLOAD ──
  UPLOAD_DIR: Joi.string().optional().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: Joi.number().positive().optional().default(5),

  // ── WEBHOOKS & FILA ──
  PAYMENT_WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_EKWANZA: Joi.string().allow('').optional().default(''),
  PAYMENT_WEBHOOK_SECRET_GENERIC: Joi.string().allow('').optional().default(''),
  WEBHOOK_PAYMENT_SECRET: Joi.string().allow('').optional().default(''),
  WEBHOOK_SECRET: Joi.string().allow('').optional().default(''),
  PAYMENT_QUEUE_NAME: Joi.string().optional().default('pagamento-confirmado'),

  // ── E-MAIL (SMTP) ──
  SMTP_HOST: Joi.string().allow('').optional().default(''),
  SMTP_PORT: Joi.number().port().allow('').optional().default(''),
  SMTP_SECURE: Joi.string().valid('true', 'false', '').allow('').optional().default('false'),
  SMTP_USER: Joi.string().allow('').optional().default(''),
  SMTP_PASS: Joi.string().allow('').optional().default(''),
  SMTP_FROM: Joi.string().allow('').optional().default(''),
  FRONTEND_URL: Joi.string().uri().allow('').optional().default(''),
  APP_URL: Joi.string().uri().allow('').optional().default(''),
});

/**
 * Validador usado pelo ConfigModule (fail-fast).
 * - Valida com Joi (abortEarly: false para listar todos os erros)
 * - Em produção aplica regras extra (secrets >=32, PAYMENT_WEBHOOK_SECRET obrigatório)
 * - Lança erro formatado e legível — a app NÃO sobe.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
    convert: true,
    stripUnknown: false,
  });

  const issues: string[] = [];

  if (error) {
    for (const detail of error.details) {
      const key = detail.path.join('.') || detail.context?.key || 'desconhecido';
      // Usa mensagem já traduzida do Joi
      issues.push(`  ✗ ${key} — ${detail.message.replace(/"/g, '')}`);
    }
  }

  // Regras extras só em produção (segurança)
  const nodeEnv = (value.NODE_ENV as string) || (config.NODE_ENV as string) || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  // Normaliza alias CORS antes das regras de produção
  if (!value.CORS_ALLOWED_ORIGINS && value.CORS_ORIGIN) {
    (value as Record<string, unknown>).CORS_ALLOWED_ORIGINS = value.CORS_ORIGIN;
  }

  if (isProd && !isTest) {
    const jwt = (value.JWT_SECRET as string) || '';
    const refresh = (value.JWT_REFRESH_SECRET as string) || '';
    const webhook =
      (value.PAYMENT_WEBHOOK_SECRET as string) ||
      (value.WEBHOOK_PAYMENT_SECRET as string) ||
      (value.WEBHOOK_SECRET as string) ||
      '';

    if (jwt.length < 32 || jwt.includes('change-me')) {
      issues.push(
        '  ✗ JWT_SECRET — em produção deve ter >=32 caracteres e não pode ser placeholder "change-me". Gere com: openssl rand -base64 32',
      );
    }
    if (refresh.length < 32 || refresh.includes('change-me')) {
      issues.push(
        '  ✗ JWT_REFRESH_SECRET — em produção deve ter >=32 caracteres e não pode ser placeholder "change-me"',
      );
    }
    if (!webhook || webhook.length < 16 || webhook.includes('change-me')) {
      issues.push(
        '  ✗ PAYMENT_WEBHOOK_SECRET — obrigatória em produção (>=16 chars, sem "change-me"). Gere com: openssl rand -base64 32',
      );
    }
    // DATABASE_URL em prod não deve apontar para localhost/postgres interno
    const dbUrl = (value.DATABASE_URL as string) || '';
    if (dbUrl.includes('@postgres:') || dbUrl.includes('@localhost:5435')) {
      issues.push(
        '  ✗ DATABASE_URL — em produção não deve apontar para postgres local (@postgres/@localhost). Use URL do Neon/provedor externo',
      );
    }
    // CORS em produção deve ser restrito — não pode ser vazio nem "*"
    const cors = ((value.CORS_ALLOWED_ORIGINS as string) || '').trim();
    if (!cors) {
      issues.push(
        '  ✗ CORS_ALLOWED_ORIGINS — obrigatória em produção. Defina lista separada por vírgula ex: https://sadivacloset.co.ao,https://www.sadivacloset.co.ao,https://api-sadivacloset.himersus.com',
      );
    } else if (cors === '*') {
      issues.push(
        '  ✗ CORS_ALLOWED_ORIGINS — em produção não pode ser "*". Defina origens explícitas separadas por vírgula (credentials:true não permite wildcard)',
      );
    }
  }

  if (issues.length > 0) {
    const banner = '━'.repeat(62);
    const header = '❌  Erro de validação de variáveis de ambiente';
    const hint = 'Corrija o ficheiro .env (veja .env.example) e reinicie a aplicação.';
    const body = issues.join('\n');
    // Mensagem que o Nest vai imprimir e que também aparece via bootstrap catch
    const formatted =
      `\n${banner}\n${header}\n${banner}\n\n` +
      `As seguintes variáveis estão em falta ou inválidas:\n\n${body}\n\n` +
      `${hint}\n${banner}\n`;

    // Lança erro que o ConfigModule propaga e impede o boot
    throw new Error(formatted);
  }

  // Normaliza alias legado de webhook para variável canónica (sem precisar de || no configuration)
  if (!value.PAYMENT_WEBHOOK_SECRET) {
    const alias =
      (value.WEBHOOK_PAYMENT_SECRET as string) || (value.WEBHOOK_SECRET as string) || '';
    if (alias) {
      (value as Record<string, unknown>).PAYMENT_WEBHOOK_SECRET = alias;
    }
  }

  // Sincroniza defaults/valores validados para process.env
  // para que configuration() possa ler apenas process.env.VAR sem fallbacks
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined && v !== null) {
      process.env[k] = String(v);
    }
  }

  return value;
}
