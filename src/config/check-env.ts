/**
 * CLI para validar .env sem subir a aplicação.
 * Uso:
 *   pnpm run env:check          → valida .env atual
 *   pnpm run env:check:example  → valida .env.example
 *
 * Fail-fast: imprime erro formatado e sai com código 1 se faltar variável.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { validateEnv } from './env.validation';

const useExample = process.argv.includes('--example');
const envFile = useExample ? '.env.example' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  console.error(`❌ Ficheiro ${envFile} não encontrado em ${envPath}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
console.log(`🔍 A validar ${envFile} (${Object.keys(parsed).length} variáveis)...`);

try {
  const validated = validateEnv(parsed);
  console.log(`✔ ${envFile} válido — ${Object.keys(validated).length} variáveis carregadas`);
  console.log(`  NODE_ENV=${validated.NODE_ENV}  PORT=${validated.PORT}`);
  if (useExample) {
    console.log(
      '  ℹ️  .env.example usa placeholders; em produção use secrets fortes (openssl rand -base64 32)',
    );
  }
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
}
