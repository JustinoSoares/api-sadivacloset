export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  database: { url: string };
  redis: { url: string };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  ekwanza: {
    apiBaseUrl: string;
    notificationToken: string;
    apiKey: string;
    merchantRegistrationNumber: string;
    httpTimeoutMs: number;
  };
  cors: {
    allowedOrigins: string[];
    allowAll: boolean;
  };
  upload: { dir: string; maxSizeMb: number };
  webhook: {
    paymentSecret: string;
    paymentSecrets: Record<string, string>;
    signatureHeaders: string[];
  };
  queue: { paymentConfirmed: string };
  mail: {
    host?: string;
    port?: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  };
  frontendUrl: string;
}

function parseCorsOrigins(raw?: string): { allowedOrigins: string[]; allowAll: boolean } {
  const v = (raw || '').trim();
  if (!v || v === '*') {
    return { allowedOrigins: [], allowAll: v === '*' || !v };
  }
  const list = v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { allowedOrigins: list, allowAll: false };
}

// Todas as variáveis já foram validadas e com defaults aplicados por validateEnv (Joi).
// Por isso aqui lê-se APENAS process.env.VAR — sem fallbacks.
export default (): AppConfig => ({
  port: parseInt(process.env.PORT!, 10),
  nodeEnv: process.env.NODE_ENV! as AppConfig['nodeEnv'],
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
  },
  ekwanza: {
    apiBaseUrl: process.env.EKWANZA_API_BASE_URL!,
    notificationToken: process.env.EKWANZA_NOTIFICATION_TOKEN!,
    apiKey: process.env.EKWANZA_API_KEY!,
    merchantRegistrationNumber: process.env.EKWANZA_MERCHANT_REGISTRATION_NUMBER!,
    httpTimeoutMs: parseInt(process.env.EKWANZA_HTTP_TIMEOUT_MS!, 10),
  },
  cors: parseCorsOrigins(
    process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '',
  ),
  upload: {
    dir: process.env.UPLOAD_DIR!,
    maxSizeMb: parseInt(process.env.UPLOAD_MAX_SIZE_MB!, 10),
  },
  webhook: {
    paymentSecret: process.env.PAYMENT_WEBHOOK_SECRET!,
    paymentSecrets: Object.fromEntries(
      Object.entries(process.env)
        .filter(([k, v]) => k.startsWith('PAYMENT_WEBHOOK_SECRET_') && v)
        .map(([k, v]) => [k.replace('PAYMENT_WEBHOOK_SECRET_', '').toLowerCase(), v as string]),
    ) as Record<string, string>,
    signatureHeaders: ['x-signature', 'x-webhook-signature', 'signature', 'x-hub-signature'],
  },
  queue: {
    paymentConfirmed: process.env.PAYMENT_QUEUE_NAME!,
  },
  mail: {
    host: process.env.SMTP_HOST || undefined,
    port:
      process.env.SMTP_PORT && !isNaN(parseInt(process.env.SMTP_PORT, 10))
        ? parseInt(process.env.SMTP_PORT, 10)
        : undefined,
    secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@sadivacloset.co.ao',
  },
  frontendUrl:
    process.env.FRONTEND_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
});
