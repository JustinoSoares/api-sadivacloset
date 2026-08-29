export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bridpay: {
    baseUrl: process.env.BRIDPAY_BASE_URL || 'http://localhost:3000',
    apiKey: process.env.BRIDPAY_API_KEY || '',
    environment: (process.env.BRIDPAY_ENVIRONMENT as 'live' | 'sandbox') || 'sandbox',
  },
  // Provider real usado pela BridPay – copiado de ../api-bridpay/.env
  appypay: {
    environment: process.env.APPYPAY_ENVIRONMENT || 'sandbox',
    authUrl: process.env.APPYPAY_AUTH_URL || 'https://login.microsoftonline.com/{tenant}/oauth2/token',
    tenant: process.env.APPYPAY_TENANT || '',
    clientId: process.env.APPYPAY_CLIENT_ID || '',
    clientSecret: process.env.APPYPAY_CLIENT_SECRET || '',
    resource: process.env.APPYPAY_RESOURCE || '',
    apiBaseUrl: process.env.APPYPAY_API_BASE_URL || 'https://gwy-api.appypay.co.ao',
    merchantIdentifier: process.env.APPYPAY_MERCHANT_IDENTIFIER || '',
    optionsApiKey: process.env.APPYPAY_OPTIONS_API_KEY || '',
    paymentMethodGpo: process.env.APPYPAY_PAYMENT_METHOD_GPO || 'GPO_0d23d2b0-c19c-42ca-b423-38c150acac5e',
    paymentMethodReference: process.env.APPYPAY_PAYMENT_METHOD_REFERENCE || 'REF_8d9c9851-4d33-4d8d-82b5-3d3b4cea5d92',
    webhookSecret: process.env.APPYPAY_WEBHOOK_SECRET || '',
    httpTimeoutMs: parseInt(process.env.APPYPAY_HTTP_TIMEOUT_MS || '10000', 10),
  },
  ekwanza: {
    apiBaseUrl: process.env.EKWANZA_API_BASE_URL || 'https://api.e-kwanza.co.ao',
    notificationToken: process.env.EKWANZA_NOTIFICATION_TOKEN || '',
    apiKey: process.env.EKWANZA_API_KEY || '',
    merchantRegistrationNumber: process.env.EKWANZA_MERCHANT_REGISTRATION_NUMBER || '',
    httpTimeoutMs: parseInt(process.env.EKWANZA_HTTP_TIMEOUT_MS || '10000', 10),
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxSizeMb: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '5', 10),
  },
  webhook: {
    // HMAC genérico para POST /webhooks/pagamento/:gateway – quando não há gateway real escolhido
    // Se vazio, validação é skipada em dev (log warning). Em prod deve estar definido.
    paymentSecret: process.env.PAYMENT_WEBHOOK_SECRET || process.env.WEBHOOK_PAYMENT_SECRET || process.env.WEBHOOK_SECRET || '',
    paymentSecrets: Object.fromEntries(
      Object.entries(process.env)
        .filter(([k, v]) => k.startsWith('PAYMENT_WEBHOOK_SECRET_') && v)
        .map(([k, v]) => [k.replace('PAYMENT_WEBHOOK_SECRET_', '').toLowerCase(), v as string]),
    ) as Record<string, string>,
    // nomes de header aceites para assinatura
    signatureHeaders: ['x-signature', 'x-webhook-signature', 'signature', 'x-hub-signature'],
  },
  queue: {
    paymentConfirmed: process.env.PAYMENT_QUEUE_NAME || 'pagamento-confirmado',
  },
});
