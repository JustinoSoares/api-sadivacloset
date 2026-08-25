# SadivaCloset API

API REST em **NestJS + TypeScript + Prisma + PostgreSQL + Redis**.  
Stack assumida para o plano completo: NestJS (módulos/guards/DI), Prisma/Postgres, Redis para cache de listagens públicas (`/produtos`, `/categorias`), rate limiting (`@nestjs/throttler` + store Redis) e fila **BullMQ** para webhooks de pagamento/notificações. Paginação clássica `?page=&limit=` em todos os listáveis (incluindo `/admin/produtos` — scroll infinito consome páginas).

> Este repositório contém apenas o **esqueleto**: infraestrutura a subir, sem rotas de negócio ainda.

---

## Pré-requisitos

- Node 20+
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker + Docker Compose v2

## Quick start

```bash
# 1) Clonar e configurar env
cp .env.example .env
# edita .env se precisares (JWT_SECRET, etc.)

# 2) Instalar deps (gera pnpm-lock.yaml)
pnpm install

# 3) Subir infra (api hot-reload + postgres:16 + redis:7)
docker compose up -d --build

# 4) Ver logs
docker compose logs -f api

# 5) Migração (dentro do container ou no host)
# via container (usa postgres:5432 / redis:6379 internos):
docker compose exec api pnpm exec prisma migrate dev --name init
# via host (usa localhost:5435 — precisa do .env com @localhost):
# DATABASE_URL="postgresql://sadiva:sadiva123@localhost:5435/sadivacloset?schema=public" pnpm run prisma:migrate
# ou com Neon:
# DATABASE_URL="postgresql://neondb_owner:...@ep-...neon.tech/neondb?sslmode=require" pnpm run prisma:migrate

# 6) Seed
docker compose exec api pnpm run db:seed
# ou no host:
# DATABASE_URL="postgresql://sadiva:sadiva123@localhost:5435/sadivacloset?schema=public" pnpm run db:seed

# 7) Testar
curl http://localhost:3001/        # { name, status }
curl http://localhost:3001/health  # { status, database, timestamp }
```

## Serviços Docker

| Serviço   | Imagem          | Porta host → container | Volume persistente | Healthcheck |
|-----------|-----------------|------------------------|--------------------|-------------|
| api       | node:20-alpine  | `${PORT:-3001} → ${PORT:-3001}` (default 3001) | — (bind mount para hot reload) | — |
| postgres  | postgres:16-alpine | 5435 → 5432   | `postgres_data`    | `pg_isready` |
| redis     | redis:7-alpine  | 6381 → 6379       | `redis_data`       | `redis-cli ping` |

> Portas host 5435/6381 evitam conflito com valkey/bridpay/lexai já em 5432/5433/5434 e 6379/6380. Ajusta no `docker-compose.yml` se precisares.

Rede interna: `sadiva-network` (bridge).

Hot reload: `src/`, `prisma/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` montados como volumes; `node_modules` anonimizado para não ser sobrescrito. `pnpm exec prisma generate` corre automaticamente no arranque do container (`command: sh -c "pnpm exec prisma generate && pnpm run start:dev"`). Alterações em `src/` reiniciam o `nest start --watch` dentro do container.

## Variáveis de ambiente

Ver `.env.example`. Obrigatórias (validadas no arranque via Joi no `ConfigModule`):

- `DATABASE_URL` — ex: `postgresql://sadiva:sadiva123@postgres:5432/sadivacloset?schema=public` (dentro do Docker) / `postgresql://sadiva:sadiva123@localhost:5435/sadivacloset?schema=public` no host
- `REDIS_URL` — ex: `redis://redis:6379` (Docker) / `redis://localhost:6381` no host
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — `openssl rand -base64 32`
- `JWT_EXPIRES_IN` — ex: `15m` (+ `JWT_REFRESH_EXPIRES_IN=7d`)
- `PORT` — default `3001` (mapeada 1:1 no compose: `${PORT}:${PORT}`)

`ConfigModule` é global e falha fast se faltar validação.

## Estrutura

```
src/
  main.ts
  app.module.ts
  app.controller.ts
  config/
    configuration.ts
    env.validation.ts   # Joi schema
  common/
    dto/pagination.dto.ts  # ?page=&limit= + helpers PaginatedResult
  modules/
    prisma/             # PrismaService global
    health/             # GET /health (checa SELECT 1)
    auth/               # placeholder
    users/
    products/
    categories/
    orders/
    queue/              # BullMQ placeholder (Redis)
prisma/
  schema.prisma
  seed.ts
docker-compose.yml
Dockerfile              # multi-stage: development (watch) + production (pnpm)
pnpm-lock.yaml
```

## Scripts pnpm

| Script | Descrição |
|--------|-----------|
| `pnpm run start:dev` | Nest watch (usado no container) |
| `pnpm run build` / `pnpm run start:prod` | Build + run prod |
| `pnpm run prisma:generate` | Gera Prisma Client |
| `pnpm run prisma:migrate` | `prisma migrate dev` (cria migration + aplica) |
| `pnpm run prisma:migrate:deploy` | `prisma migrate deploy` (CI/prod) |
| `pnpm run db:seed` | `ts-node prisma/seed.ts` (idempotente) |
| `pnpm run db:reset` | Reset + re-seed (dev) |

## Notas de produção

- Trocar `ThrottlerModule` para `ThrottlerStorageRedisService` (ioredis + `REDIS_URL`) quando activar rate limiting com Redis.
- BullMQ: criar `Queue`/`Worker` apontando para `REDIS_URL`; usado para webhooks e notificações.
- Paginação: todos os GET listáveis aceitam `?page=&limit=` (default 1/20, max 100) via `PaginationDto`.

## Troubleshooting

### EADDRINUSE: address already in use :::3001 (ou :::3000)
Tens dois cenários comuns neste host:
- `bridpay-api` já ocupa `3000`, `valkey` ocupa `6379`, etc. (ver `docker ps`/`ss -tulpn`).
- Corres `docker compose up -d` (api em 3001) **e** `pnpm run start:dev` no host na mesma porta.

O `src/main.ts:37` agora deteta `EADDRINUSE` e mostra ajuda em PT.

**Soluções:**
```bash
# ver o que ocupa:
ss -tulpn | grep 3001
lsof -i :3001
docker ps --format "table {{.Names}}\t{{.Ports}}"

# 1) Usar só Docker (recomendado para este esqueleto):
docker compose up -d --build
docker compose logs -f api

# 2) Correr API no host com deps no Docker:
docker compose up -d postgres redis   # sem api
# usa localhost:5435 / localhost:6381 no host:
DATABASE_URL="postgresql://sadiva:sadiva123@localhost:5435/sadivacloset?schema=public" \
REDIS_URL="redis://localhost:6381" \
pnpm run start:dev

# 3) Correr noutra porta:
PORT=3002 pnpm run start:dev
# ou muda PORT no .env e reinicia: docker compose up -d --build

# 4) Parar tudo e escolher:
docker compose down
pnpm run start:dev
```

### Can't reach database server at `postgres:5432` (P1001)
No host o `DATABASE_URL` não pode ser `postgres:5432` — esse hostname só existe dentro da rede `sadiva-network`.
- No host usa `localhost:5435`: `DATABASE_URL="postgresql://sadiva:sadiva123@localhost:5435/sadivacloset?schema=public"`
- Ou usa Neon: descomenta a linha Neon no `.env` (ver `src/config/env.validation.ts:9`)
- Dentro do Docker mantém `postgres:5432`.

## Próximos passos (não implementados aqui)

- Modelagem Prisma (User, Category, Product, Order, etc.) + migrations
- Auth JWT + refresh + guards
- CRUDs + cache Redis para listagens públicas
