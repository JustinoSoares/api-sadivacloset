export default async () => {
  // Use isolated test database - local container sadivacloset_test
  // This is set before any app import, so ConfigModule and Prisma will use test DB
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    'postgresql://sadiva:sadiva123@localhost:5435/sadivacloset_test?schema=public';
  process.env.REDIS_URL = process.env.REDIS_URL_TEST || 'redis://localhost:6381';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-32chars-for-e2e-tests';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-32chars-e2e';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-32chars-e2e';
  process.env.PAYMENT_WEBHOOK_SECRET_GENERIC = 'test-webhook-secret-32chars-e2e';
  process.env.PAYMENT_QUEUE_NAME = 'pagamento-confirmado-test';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // random port for supertest

  console.log('[e2e globalSetup] DATABASE_URL =', process.env.DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
};
