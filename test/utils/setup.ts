import { execSync } from 'child_process';

// Ensure test DB is migrated before running tests
// This runs once per jest worker, but we also do it in globalSetup via migrate deploy
beforeAll(() => {
  // suppress pino pretty logs in tests
  process.env.NODE_ENV = 'test';
});
