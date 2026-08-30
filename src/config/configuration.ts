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
  bridpay: { baseUrl: string; apiKey: string; environment: 'live' | 'sandbox' };
  appypay: {
    environment: 'live' | 'sandbox';
    authUrl: string;
    tenant: string;
    clientId: string;
    clientSecret: string;
    resource: string;
    apiBaseUrl: string;
    merchantIdentifier: string;
    optionsApiKey: string;
    paymentMethodGpo: string;
    paymentMethodReference: string;
    webhookSecret: string;
    httpTimeoutMs: number;
  };
  ekwanza: {
    apiBaseUrl: string;
    notificationToken: string;
    apiKey: string;
    merchantRegistrationNumber: string;
    httpTimeoutMs: number;
  };
  upload: { dir: string; maxSizeMb: number };
  webhook: {
    paymentSecret: string;
    paymentSecrets: Record<string, string>;
    signatureHeaders: string[];
  };
  queue: { paymentConfirmed: string };
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
  bridpay: {
    baseUrl: process.env.BRIDPAY_BASE_URL!,
    apiKey: process.env.BRIDPAY_API_KEY!,
    environment: process.env.BRIDPAY_ENVIRONMENT! as 'live' | 'sandbox',
  },
  appypay: {
    environment: process.env.APPYPAY_ENVIRONMENT! as 'live' | 'sandbox',
    authUrl: process.env.APPYPAY_AUTH_URL!,
    tenant: process.env.APPYPAY_TENANT!,
    clientId: process.env.APPYPAY_CLIENT_ID!,
    clientSecret: process.env.APPYPAY_CLIENT_SECRET!,
    resource: process.env.APPYPAY_RESOURCE!,
    apiBaseUrl: process.env.APPYPAY_API_BASE_URL!,
    merchantIdentifier: process.env.APPYPAY_MERCHANT_IDENTIFIER!,
    optionsApiKey: process.env.APPYPAY_OPTIONS_API_KEY!,
    paymentMethodGpo: process.env.APPYPAY_PAYMENT_METHOD_GPO!,
    paymentMethodReference: process.env.APPYPAY_PAYMENT_METHOD_REFERENCE!,
    webhookSecret: process.env.APPYPAY_WEBHOOK_SECRET!,
    httpTimeoutMs: parseInt(process.env.APPYPAY_HTTP_TIMEOUT_MS!, 10),
  },
  ekwanza: {
    apiBaseUrl: process.env.EKWANZA_API_BASE_URL!,
    notificationToken: process.env.EKWANZA_NOTIFICATION_TOKEN!,
    apiKey: process.env.EKWANZA_API_KEY!,
    merchantRegistrationNumber: process.env.EKWANZA_MERCHANT_REGISTRATION_NUMBER!,
    httpTimeoutMs: parseInt(process.env.EKWANZA_HTTP_TIMEOUT_MS!, 10),
  },
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
});
