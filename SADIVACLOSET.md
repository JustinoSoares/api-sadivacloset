# SADIVACLOSET.md — Definitive Frontend Documentation (v0.1.0)

> **Purpose:** this file is the single source a frontend AI needs to implement the **entire** SadivaCloset frontend. If the developer points this `SADIVACLOSET.md` to the AI (Cursor, Copilot, Claude, ChatGPT), it must be able to generate: screens, routes, `axios/fetch` services, stores, guards, forms, validations, pagination, error handling and complete flows without asking anything.
>
> **Target frontend stack:** any SPA (React/Next.js, Vue/Nuxt, Angular). Examples below in **TypeScript + Axios** (adaptable).
> **Language:** code/tables/endpoints/messages all in **English** (`{ error: { code, message, details } }`, pagination `{ data, page, total, totalPages }`).

---

## 0. How to Use with AI — Ready Prompt

Copy and paste to your AI:

```
You are a senior frontend developer. Read the file SADIVACLOSET.md at the root of project api-sadivacloset.
Implement the complete frontend consuming this API. RULES:
- Base URL (Staging primary) = https://api-sadivacloset.himersus.com/api/v1 (health at https://api-sadivacloset.himersus.com/health without prefix). Local alternative = http://localhost:3001/api/v1.
- Swagger UI = https://api-sadivacloset.himersus.com/api/docs (local http://localhost:3001/api/docs). OpenAPI JSON = https://api-sadivacloset.himersus.com/api/docs-json.
- Use English-only contract (endpoints /auth/*, /products, /cart, /checkout, /orders, /profile/*, /favorites, /notifications, /admin/*). PT aliases (/produtos, /carrinho, /pedidos, /perfil/*) are hidden and deprecated — DO NOT use. Backend still accepts them for backward compat but Swagger shows EN only.
- All responses are English-only: pagination { data, page, total, totalPages }, errors { error: { code, message, details: [{ field, errors }] } }. There is no dados/pagina/total_paginas or erro/codigo/mensagem — do not handle fallbacks.
- DTOs are English-only: address { label, province, municipality, neighborhood, street, reference, isDefault }, cart { items, subtotal, totalItems, totalQuantity }, payment { orderId, method, amount, status, externalReference, receiptUrl }, order { buyerId, deliveryFee, status, createdAt, items, delivery, payment }.
- Auth JWT Bearer + refresh. Store access_token + refresh_token. Use interceptor on 401 -> POST /auth/refresh with { refresh_token }.
- Pagination is ?page=&limit= (default 1/20, max 100) on ALL list endpoints. Read res.data.data, res.data.page, res.data.total, res.data.totalPages.
- Respect rate limiting (/auth and /checkout) and guards (buyer vs admin).
- Payment receipt is NOT multipart — frontend hosts the image (S3/Cloudinary) and sends only JSON { receiptUrl } to POST /orders/:id/payment/receipt.
- Display error.message directly (English). Use error.code for logic (INSUFFICIENT_STOCK, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMIT_EXCEEDED, etc.).
Follow ALL detailed flows in SADIVACLOSET.md and generate typed TypeScript code.
```

---

## 1. Overview & URLs

| Item | Value |
|------|-------|
| **Base URL (Staging – primary)** | `https://api-sadivacloset.himersus.com/api/v1` (global prefix via `app.setGlobalPrefix('api/v1')`) |
| **Base URL (Local – alternative)** | `http://localhost:3001/api/v1` |
| **Health (public, no prefix)** | `GET https://api-sadivacloset.himersus.com/health` → `{ status:"ok", database:"up", timestamp }` (local `http://localhost:3001/health`) |
| **Root (public, no prefix)** | `GET https://api-sadivacloset.himersus.com/` → `{ name, status }` |
| **Swagger UI (Staging)** | `https://api-sadivacloset.himersus.com/api/docs` |
| **Swagger UI (Local)** | `http://localhost:3001/api/docs` |
| **OpenAPI JSON (Staging)** | `https://api-sadivacloset.himersus.com/api/docs-json` (import into Postman/Insomnia or generate SDK) |
| **OpenAPI JSON (Local)** | `http://localhost:3001/api/docs-json` |
| **Version** | `0.1.0` |
| **Code language** | English (tables, columns, enums, endpoints, DTOs) |
| **User messages** | English (`error.code`/`error.message` in English) |
| **Docker host alternates** | `http://localhost:3002/api/v1` if `PORT=3002` in `.env` |

**Generate SDK automatically:**
```bash
# Staging (primary)
npx openapi-generator-cli generate -i https://api-sadivacloset.himersus.com/api/docs-json -g typescript-axios -o ./frontend-sdk
# Local alternative
npx openapi-generator-cli generate -i http://localhost:3001/api/docs-json -g typescript-axios -o ./frontend-sdk
# or typescript-fetch
```

**CORS:** `origin: true, credentials: true` in dev; restricted via env in prod.
**Security headers:** `helmet()` + `X-Powered-By` removed.

---

## 2. Global Conventions (READ BEFORE CODING)

### 2.1 Prefix & Deprecated PT Aliases (Routes + DTO fields now English-only in Swagger)
The backend keeps **two routes for almost everything** for backward compat:
- **Canonical EN** (documented, use this): `/products`, `/cart`, `/checkout`, `/orders`, `/profile/*`, `/admin/products`…
- **Alias PT hidden** (`@ApiExcludeController`/`@ApiExcludeEndpoint`, deprecated): `/produtos`, `/carrinho`, `/pedidos`, `/perfil/*`, `/admin/produtos`…

**Frontend rule:** ALWAYS use EN routes. The PT alias does not appear in Swagger, is deprecated, and must not be used in new code. It still works if called (backend normalizes via getters/normalized `*Normalized` accessors), but frontend MUST NOT rely on it. Swagger shows EN only.

**DTO field aliases are now hidden from Swagger:** every DTO exposes **English fields via `@ApiProperty` / `@ApiPropertyOptional` (visible in Swagger UI at https://api-sadivacloset.himersus.com/api/docs)** and **Portuguese legacy fields via `@ApiHideProperty` (hidden from Swagger but still accepted at runtime via `class-transformer` `@Transform`/getters for backward compat)**. Frontend MUST send **English only** – examples and tables in this doc show English-only payloads.

| DTO | English field (`@ApiProperty` – **visible** in Swagger) | Legacy PT alias (`@ApiHideProperty` – **hidden** from Swagger, still accepted via `Transform`/`*Normalized`) | Example English (use this) | Legacy PT (DO NOT USE) |
|-----|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|----------------------------|------------------------|
| `RegisterDto` (`src/modules/auth/dto/register.dto.ts:6`) | `name` | `nome` (`@ApiHideProperty` `register.dto.ts:12`) | `{ "name": "Maria Silva" }` | `{ "nome": "Maria Silva" }` hidden |
| `AddCartItemDto` (`src/modules/cart/dto/add-cart-item.dto.ts:6`) | `productId`, `quantity` | `produto_id`, `product_id`, `quantidade` (`@ApiHideProperty` `add-cart-item.dto.ts:11`) | `{ "productId": "uuid", "quantity": 2 }` | `{ "produto_id": "uuid", "quantidade": 2 }` hidden |
| `CheckoutDto` (`src/modules/checkout/dto/checkout.dto.ts:8`) | `type`, `scheduledDate`, `timeWindow`, `addressId`, `deliveryZoneId` | `tipo`, `data_agendada`/`scheduled_date`, `janela_horario`/`time_window`, `endereco_id`/`address_id`, `zona_entrega_id`/`delivery_zone_id` (`@ApiHideProperty` `checkout.dto.ts:16,21,31,36,54,68,73,85,92`) | `{ "type": "HOME_DELIVERY", "scheduledDate": "2026-09-01", "timeWindow": "09:00-12:00", "addressId": "uuid", "deliveryZoneId": "uuid" }` | `{ "tipo": "domicilio", "data_agendada": "2026-09-01", "janela_horario": "09:00-12:00", "endereco_id": "uuid" }` hidden |
| `CreateAddressDto` / `UpdateAddressDto` (`src/modules/addresses/dto/create-address.dto.ts:20`) | `label`, `province`, `municipality`, `neighborhood`, `street`, `reference`, `latitude`, `longitude` | `etiqueta`, `provincia`, `municipio`, `bairro`, `rua`, `referencia` (`@ApiHideProperty` `create-address.dto.ts:27,41,55,69,83,96`) | `{ "label": "Home", "province": "Luanda", "municipality": "Talatona", "neighborhood": "Talatona", "street": "Street 123", "reference": "Near market" }` | `{ "etiqueta": "Home", "provincia": "Luanda" }` hidden |
| `UpdateDeliveryDto` (`src/modules/orders/dto/update-delivery.dto.ts:8`) | `addressId`, `scheduledDate`, `timeWindow`, `instructions` | `endereco_id`/`address_id`/`enderecoId`, `data_agendada`/`scheduled_date`, `janela_horario`/`time_window`, `instrucoes` (`@ApiHideProperty` `update-delivery.dto.ts:16,21,36,41,53,60,73`) | `{ "addressId": "uuid", "scheduledDate": "2026-09-10", "timeWindow": "09:00-12:00", "instructions": "Leave at door" }` | `{ "endereco_id": "uuid", "data_agendada": "2026-09-10", "janela_horario": "09:00-12:00" }` hidden |
| `IniciarPagamentoDto` / `InitiatePaymentDto` (`src/modules/payments/dto/iniciar-pagamento.dto.ts:8`) | `method`, `phoneNumber`, `iban`, `description`, `expiresInSeconds` | `metodo`, `telefone`, `descricao` (`@ApiHideProperty` `iniciar-pagamento.dto.ts:15,30,50`) | `{ "method": "BANK_TRANSFER", "phoneNumber": "923456789", "description": "Order #123" }` | `{ "metodo": "transferencia", "telefone": "923456789", "descricao": "Pedido #123" }` hidden |
| `FilterProductsDto` (`src/modules/products/dto/filter-products.dto.ts:66`) | `q`, `category`, `size`, `condition`, `price_min`, `price_max`, `sort` | `categoria`, `tamanho`, `estado`, `preco_min`, `preco_max`, `ordenar` (`@ApiHideProperty` `filter-products.dto.ts:80,92,111,124,138,150`) | `?category=SUITS&size=M&condition=NEW&price_min=10000&price_max=50000&sort=price_asc` | `?categoria=SUITS&tamanho=M&estado=NOVO&preco_min=10000&ordenar=preco_asc` hidden |
| `FilterOrdersDto` / `FilterDeliveriesDto` / `FilterAuditDto` | `status`, `from`/`to`, `entity`, `page`, `limit` | `estado`, `data_inicio`/`data_fim`, `entidade`, `pagina`/`limite` (`@ApiHideProperty`) | `?status=PAID&from=2026-01-01&to=2026-01-31&page=1&limit=20` | `?estado=pago&data_inicio=...` hidden |
| `Receipt` (payments) | `receiptUrl` | `comprovativo_url` / `comprovativoUrl` (legacy, hidden if present) | `{ "receiptUrl": "https://cdn.myapp.com/receipts/abc.jpg" }` | `{ "comprovativo_url": "https://..." }` hidden |

> **Runtime:** PT aliases still work via `Transform` (`obj.name ?? obj.nome`, `obj.method ?? obj.metodo`, `typeNormalized`, `quantityNormalized`, etc.) and `*Normalized` getters, so old clients do not break. **Swagger:** PT fields are `@ApiHideProperty` → they **do not appear** in `https://api-sadivacloset.himersus.com/api/docs` nor in `docs-json` SDK generation. Use only the English column.

Examples and tables below show **English-only payloads**.

### 2.2 Response Shape — English-only
Every endpoint returns **English keys only**:

```json
{
  "data": [{ "id": "uuid" }],
  "page": 1,
  "total": 25,
  "totalPages": 2,
  "message": "ok"
}
```
Single item:
```json
{ "data": { "id": "uuid", "name": "Black Suit" } }
```
Action without data:
```json
{ "message": "Item removed successfully" }
```

**Do not handle bilingual fallbacks** (`dados`/`pagina`/`total_paginas`/`mensagem`). They do not exist after the English-only migration.

**Frontend helpers (English-only):**
```ts
const list = res.data.data;
const page = res.data.page;
const totalPages = res.data.totalPages;
const total = res.data.total;
const item = res.data.data; // for GET /products/:id
const msg = res.data.message;
```

### 2.3 Classic Pagination — on ALL listable `GET`
`PaginationDto` (`src/common/dto/pagination.dto.ts:9`): `?page=1&limit=20`
- `page`: `int >=1`, default `1`
- `limit`: `int 1..100`, default `20`, max `100`
- Getters: `skip = (page-1)*limit`, `take = limit`

Paginated response (`buildPaginatedResponse` `pagination.dto.ts:74`):
```json
{ "data": [], "page": 1, "total": 80, "totalPages": 4 }
```

Frontend: use `?page&limit` on `/products`, `/profile/orders`, `/admin/products`, `/admin/orders`, `/admin/deliveries`, `/admin/members`, `/admin/audit`, `/payments/history`, `/wallet/history`.

Legacy `meta: {page, limit, total, totalPages}` is deprecated – use the shape above.

### 2.4 Errors — Single English Format
`ValidationPipe` (`main.ts:23`) with `whitelist:true, forbidNonWhitelisted:true` + `HttpExceptionFilter` global. **All errors** look like:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "errors": ["email must be a valid email"] }]
  }
}
```

| Status | `code` | When | Frontend action |
|--------|----------|--------|-----------------|
| 400 | `VALIDATION_ERROR` / `INVALID_REQUEST` | DTO failed, extra field (`forbidNonWhitelisted`), stock | show `details[].field -> errors[]` inline in form |
| 400 | `INSUFFICIENT_STOCK` | `POST /cart/items`, `POST /checkout` (details with `available`, `requested`) | toast with available stock |
| 400 | `CART_EMPTY` | `POST /checkout` without items | redirect to cart |
| 400 | `INVALID_METHOD` | `POST /orders/:id/payment/init` unknown method | show valid list |
| 400 | `ADDRESS_IN_USE` | `DELETE /profile/addresses/:id` single address with pending orders | block delete, show warning |
| 400 | `ORDER_ALREADY_CANCELLED`, `ORDER_NOT_CANCELLABLE`, `DELIVERY_IN_PROGRESS` | cancel/delivery when `ON_THE_WAY` | disable cancel button |
| 400 | `MISSING_REFERENCE` / `MISSING_SIGNATURE` / `INVALID_SIGNATURE` | Webhook missing fields | (frontend never calls) |
| 401 | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `ACCOUNT_INACTIVE` | `JwtAuthGuard` failed, refresh expired, logout | redirect to login, try refresh |
| 403 | `FORBIDDEN` | `BUYER` tries `/admin/*` (`RolesGuard`) | show 403, do not retry |
| 404 | `NOT_FOUND` | Resource not found **OR** not owned by buyer (IDOR → 404 not 403, to avoid enumeration) | generic message, do not reveal existence |
| 409 | `CONFLICT` / `EMAIL_ALREADY_EXISTS` | `POST /auth/register` duplicate email, `PATCH /profile` or `PATCH /admin/account` email in use | error on email field |
| 409/400 | `CURRENT_PASSWORD_INCORRECT` | `PATCH /admin/account` wrong password | error on currentPassword field |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit (see §2.5) | show `X-RateLimit-Reset`, retry with backoff |
| 500 | `INTERNAL_ERROR` | Unhandled exception (no stack in prod) | generic toast |

**Display `message` directly to the user** (English). Use `code` for logic.
No `erro`/`codigo`/`mensagem`/`detalhes`/`campo`/`erros` – English only.

### 2.5 Rate Limiting (Redis)
`ThrottlerModule` (`app.module.ts:73`) with `RedisThrottlerStorage`. **Only affects `/auth/*` and `/checkout`** (`skipIf` `app.module.ts:86`):

| Throttler | Limit | TTL | Routes |
|-----------|-------|-----|--------|
| `auth` | 20 | 60s | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/reset-password` |
| `forgot` | 5 | 15min | `POST /auth/forgot-password` |
| `checkout` | 10 | 60s | `POST /checkout` |
| `default` | 60 | 60s | fallback (but `skipIf` disables outside above) |

Response `429`:
```json
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please try again later." } }
```
Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
`GET /products`, `GET /health`, `GET /profile`, `GET /cart` **are not rate-limited**.

### 2.6 Authentication & Guards
- **Type:** `JWT Bearer` (`Authorization: Bearer <access_token>`)
- `JwtAuthGuard` (`jwt-auth.guard.ts:16`): extracts `Authorization`, verifies with `JWT_SECRET`, injects `request.user = { sub, email, role, iat, exp }`. Without `@Public()` → 401.
- `@Public()` marks public routes: `auth/*`, `products`, `categories`, `delivery-zones`, `health`, `webhooks/*`.
- `RolesGuard` (`roles.guard.ts:14`): `normalizeRole`, fallback `isAdminPath` → if URL contains `/admin` and no `@Roles`, requires `admin` automatically. Buyer on admin → 403.
- Tokens: `access_token` (`JWT_EXPIRES_IN=15m`), `refresh_token` (`JWT_REFRESH_EXPIRES_IN=7d`). Refresh is **rotating + blacklist Redis** (`blacklist:refresh:<hash>`).

### 2.7 Headers
**Authenticated:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
x-request-id: <uuid> (optional, generated if missing)
```
**Webhooks (public, HMAC — frontend NEVER calls):**
```
x-signature: <hex HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET)>
Content-Type: application/json
```

### 2.8 Global Validation
- `whitelist:true` + `forbidNonWhitelisted:true` → sending undeclared field → 400.
- `transform:true` → query `?page=1` auto-coerced to number.
- `rawBody` captured (`express.json verify`) for HMAC of webhooks.

### 2.9 Swagger English-only (`@ApiProperty` vs `@ApiHideProperty`)

**All DTOs are now Swagger English-only.** Every field that is part of the public contract is decorated with `@ApiProperty` / `@ApiPropertyOptional` (English, **visible** in Swagger). Every legacy Portuguese alias is decorated with `@ApiHideProperty` (**hidden** from Swagger, still accepted at runtime).

- **Swagger UI:** `https://api-sadivacloset.himersus.com/api/docs` (local `http://localhost:3001/api/docs`) shows **only English fields**. OpenAPI JSON `https://api-sadivacloset.himersus.com/api/docs-json` likewise contains only English properties – generate the frontend SDK from this URL and you will get English-only types (`name`, `productId`, `quantity`, `type`, `scheduledDate`, `timeWindow`, `addressId`, `deliveryZoneId`, `label`, `province`, `municipality`, `neighborhood`, `street`, `reference`, `method`, `phoneNumber`, `description`, `receiptUrl`, `category`, `size`, `condition`, `price_min`, `price_max`, `sort`, `status`, `from`, `to`, etc.).
- **Runtime:** PT aliases (`nome`, `produto_id`, `quantidade`, `tipo`, `data_agendada`, `janela_horario`, `endereco_id`, `zona_entrega_id`, `etiqueta`, `provincia`, `municipio`, `bairro`, `rua`, `referencia`, `metodo`, `telefone`, `descricao`, `categoria`, `tamanho`, `estado`, `preco_min`, `preco_max`, `ordenar`, `comprovativo_url`, etc.) are still accepted via `class-transformer` `@Transform(({ obj }) => obj.english ?? obj.pt)` and `*Normalized` getters (see table in §2.1). This is for **backward compat only – frontend MUST NOT send them**. They are hidden and will be removed in a future major.
- **Frontend rule:** send **English only**; read **English only** (`{ data, page, total, totalPages }`, `{ error: { code, message, details: [{ field, errors }] } }`). Do not implement fallbacks for PT keys. If you inspect `docs-json` and do not see a PT field, that is intentional.
- **Validation example (English-only) – `POST /auth/register`:**
  ```json
  { "name": "Maria Silva", "email": "maria@example.com", "password": "StrongPass123" }
  ```
  Do **not** send `{ "nome": "Maria Silva", "email": "maria@example.com", "password": "StrongPass123" }` – `nome` is `@ApiHideProperty` (hidden) and deprecated, even though the backend still maps it via `@Transform(({ obj }) => obj.name ?? obj.nome)` for compat.

> Generate types: `npx openapi-generator-cli generate -i https://api-sadivacloset.himersus.com/api/docs-json -g typescript-axios -o ./frontend-sdk` – you will see only English props.

---

## 3. Data Models (Prisma `schema.prisma`)

### Enums
```ts
enum Role { BUYER, ADMIN }
enum Category { SUITS, SHIRTS, DRESSES, OTHERS }
enum ProductCondition { NEW, PRE_OWNED }
enum OrderStatus { AWAITING_PAYMENT, PAID, PREPARING, SHIPPING, COMPLETED, CANCELLED }
enum DeliveryType { HOME_DELIVERY, STORE_PICKUP }
enum DeliveryStatus { SCHEDULED, ON_THE_WAY, DELIVERED, FAILED, CANCELLED }
enum PaymentMethod { MULTICAIXA_EXPRESS, MULTICAIXA_REFERENCE, BANK_TRANSFER, CASH_ON_DELIVERY, CARD }
enum PaymentStatus { PENDING, PROCESSING, PAID, FAILED, REFUNDED }
```

### Product
```ts
{ id: uuid, image: string (URL), name: string, description: string, category: Category,
  size: string, condition: ProductCondition, stock: int, price: int (cents/Kz without separator),
  discount: int 0..100, createdAt: ISO }
```

### Order + OrderItem + Delivery + Payment
```ts
Order { id, buyerId, subtotal, deliveryFee, total, status: OrderStatus, createdAt,
  items: OrderItem[], delivery?: Delivery, payment?: Payment }
OrderItem { id, orderId, productId, productName, unitPrice, discount, quantity }
Delivery { id, orderId, type: DeliveryType, addressId?: uuid, scheduledDate: Date (YYYY-MM-DD),
  timeWindow: string ("09:00-12:00"), status: DeliveryStatus, deliveryFee, instructions?: string }
Payment { id, orderId, method: PaymentMethod, amount, status: PaymentStatus,
  externalReference?: string (15 chars), receiptUrl?: string (receipt URL),
  providerTxId?, bridpayIntentId?, bridpayMerchantTxId?, providerDetails?: Json,
  phoneNumber?, iban?, webhookProcessedAt?, createdAt, updatedAt }
```

### Others
```ts
User { id, name, email, role, createdAt, isActive }
Address { id, buyerId, label, province, municipality, neighborhood, street, reference?, latitude?, longitude?, isDefault }
CartItem { id, buyerId, productId, quantity, product: Product, discountedPrice, subtotal }
Favorite { buyerId, productId }
Notification { id, buyerId, title, description, createdAt, isRead }
DeliveryZone { id, neighborhood, price } // 16 zones seed: Talatona 2500, Kilamba 3000, Viana 2500, Cazenga 2000, Maianga 1500, Sambizanga 1500, Ingombota 1200, Rangel 1500, Samba 1800, Benfica 2200, Cacuaco 2800, Zango 3200, Morro Bento 2500, Alvalade 1500, Miramar 1200, Golf2 2000
StoreConfig { id:"singleton", name, contactEmail, phone, address }
AdminPreferences { id:"singleton", notifyNewOrders, notifyLowStock, notifyNewMessages, defaultDeliveryFee, activePaymentMethods: PaymentMethod[] }
WalletTransaction { id, type: "credit"|"debit", amount, balanceBefore/After, status: "pending"|"settled", referenceType, referenceId, description, orderId?, paymentId?, bridpayTxId?, createdAt }
Payout { id, amount, iban, method, status, externalReference, providerTxId, description, orderId?, paymentId? }
AuditLog { id, adminId, action, entity, entityId, details: Json, createdAt }
```

All response DTOs expose **English fields only** (no `etiqueta`, `provincia`, `bairro`, `pedido_id`, `comprovativo_url`, etc.).

---

## 4. Authentication — Complete Flow

### 4.1 Endpoints
| Method | Route | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/auth/register` | Public | `{name, email, password}` | `201 {data:{id,name,email,role:BUYER,createdAt}}` |
| POST | `/auth/login` | Public | `{email,password}` | `200 {access_token, refresh_token}` |
| POST | `/auth/refresh` | Public | `{refresh_token}` | `200 {access_token, refresh_token}` (rotating, old blacklisted) |
| POST | `/auth/logout` | Public | `{refresh_token}` | `200 {message:"Session ended..."}` (blacklisted) |
| POST | `/auth/forgot-password` | Public (forgot 5/15min) | `{email}` | `200 {message:"If the email exists..."}` (always 200, even if email not found) |
| POST | `/auth/reset-password` | Public | `{token,newPassword}` | `200 {message:"Password reset..."}` |
| GET | `/profile` | JWT | - | `200 {data:{id,name,email,role,createdAt,isActive}}` |
| PATCH | `/profile` | JWT | `{name?,email?}` | `200 {data}` |

Deprecated PT aliases (`POST /auth/registar`, `/auth/esqueci-password`, `/auth/redefinir-password`, `GET /perfil`, `PATCH /perfil`) are hidden – do not use.

### 4.2 Rules & Errors Auth
- `register`: if email exists → 409 `EMAIL_ALREADY_EXISTS`. Otherwise creates BUYER with `bcrypt 10`.
- `login`: no user → 401 `INVALID_CREDENTIALS`; `isActive false` → 401 `ACCOUNT_INACTIVE`; wrong password → 401 `INVALID_CREDENTIALS`.
- `refresh`: check blacklist → if already used → 401 `TOKEN_REVOKED`; `verify` failed → 401 `TOKEN_INVALID`; creates new tokens and blacklists old with TTL = `JWT_REFRESH_EXPIRES_IN`.
- `logout`: verifies token, blacklists with TTL.
- `forgot`: generates `randomBytes 32 hex`, hash `sha256`, `Redis SET reset:password:<hash> userId EX 900s (15min)`, logs link `https://api-sadivacloset.himersus.com/reset-password?token=<raw>` (staging) or `http://localhost:PORT/reset-password?token=<raw>` in dev. Returns generic message to avoid enumeration.
- `reset`: `hash(token) -> Redis GET` → if not found → 400 `TOKEN_EXPIRED`; otherwise `bcrypt hash` and `prisma.user.update`, `Redis DEL`.
- `PATCH /profile`: if email already in use by another → 409 `EMAIL_ALREADY_EXISTS`.

### 4.3 Frontend Auth Implementation
```ts
// api.ts
import axios from 'axios';
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://api-sadivacloset.himersus.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
});
let accessToken = localStorage.getItem('access_token');
let refreshToken = localStorage.getItem('refresh_token');

api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(r => r, async err => {
  const orig = err.config;
  if (err.response?.status === 401 && !orig._retry && refreshToken) {
    orig._retry = true;
    if (!refreshing) refreshing = axios.post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
      .then(r => {
        accessToken = r.data.access_token; refreshToken = r.data.refresh_token;
        localStorage.setItem('access_token', accessToken!);
        localStorage.setItem('refresh_token', refreshToken!);
        return accessToken!;
      }).catch(e => { localStorage.clear(); location.href='/login'; throw e; })
      .finally(()=> refreshing=null);
    const newToken = await refreshing;
    orig.headers.Authorization = `Bearer ${newToken}`;
    return api(orig);
  }
  // normalize error – English-only
  const code = err.response?.data?.error?.code;
  const message = err.response?.data?.error?.message;
  const details = err.response?.data?.error?.details;
  return Promise.reject({ code, message, details, status: err.response?.status, raw: err });
});

// stores/auth.ts (pinia/zustand)
async function register(name:string,email:string,password:string){ const {data}=await api.post('/auth/register',{name,email,password}); return data.data; }
async function login(email:string,password:string){ const {data}=await api.post('/auth/login',{email,password}); localStorage.setItem('access_token',data.access_token); localStorage.setItem('refresh_token',data.refresh_token); return data; }
async function fetchProfile(){ const {data}=await api.get('/profile'); return data.data; }
```

UI: forms for register (name, email, password `Min8`), login, forgot (only email), reset (token from query `?token=` + newPassword), profile edit (name, email). Store `access_token` in memory + `localStorage`/`httpOnly cookie` (choice). On 401 `UNAUTHENTICATED` go to `/login`.

---

## 5. Public Catalog — Products, Categories, DeliveryZones

### 5.1 `GET /products` — Paginated, filterable, cached 60s
**Auth:** `Public` — no token.
**Query `FilterProductsDto` (`src/modules/products/dto/filter-products.dto.ts:65`) — all optional, **English-only in Swagger** (`@ApiPropertyOptional` English visible, PT hidden via `@ApiHideProperty` `filter-products.dto.ts:80,92,111,124,138,150`):**

| Query (English – **visible** in Swagger) | Type | Example | Legacy PT alias (`@ApiHideProperty` – **hidden** from Swagger, still accepted via `Transform`/`get normalized*`) |
|-------|------|---------|----------------------------------------------------------------------------------------------------------------|
| `q` | string | `?q=Suit` searches `name` OR `description` `contains insensitive` | — |
| `category` | `Category[]` CSV | `?category=SUITS,SHIRTS` | `categoria` hidden |
| `size` | `string[]` CSV | `?size=M,L` | `tamanho` hidden |
| `condition` | `ProductCondition[]` CSV | `?condition=NEW` | `estado` hidden |
| `price_min` | int | `?price_min=10000` (filters by `discountedPrice = round(price - price*discount/100)`) | `preco_min` hidden |
| `price_max` | int | `?price_max=50000` | `preco_max` hidden |
| `sort` | enum | `recent` (default), `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc` | `ordenar` hidden (`recentes`/`antigos` map still accepted) |
| `page` | int 1.. | `?page=2&limit=12` | — |
| `limit` | int 1..100 | `?limit=12` | — |

> **Swagger shows only English** (`category`, `size`, `condition`, `price_min`, `price_max`, `sort`). Legacy PT query aliases (`categoria`, `tamanho`, `estado`, `preco_min`, `preco_max`, `ordenar`) are `@ApiHideProperty` – hidden from `https://api-sadivacloset.himersus.com/api/docs` and `docs-json` but still accepted at runtime via `mapCategoryArray` / `mapConditionArray` / `get normalized*` for compat. Frontend MUST send English.

**Cache:** `Redis SET cache:products:<qs> EX 60`. Invalidated on `POST/PATCH/DELETE /admin/products`.

**Response:** `{ data: Product[], page, total, totalPages }`.

**Example Product:**
```json
{ "id":"uuid","image":"https://picsum.photos/400/400","name":"Classic Black Suit",
  "description":"...","category":"SUITS","size":"M","condition":"NEW","stock":10,"price":45000,"discount":10,
  "createdAt":"2026-01-03T00:00:00.000Z" }
```

**Implementation:**
```ts
async function listProducts(params: { q?:string, category?:string, size?:string, condition?:string, price_min?:number, price_max?:number, sort?:string, page?:number, limit?:number }){
  const {data}=await api.get('/products',{params});
  return data; // { data, page, total, totalPages }
}
// Detail
async function getProduct(id:string){ const {data}=await api.get(`/products/${id}`); return data.data; }
```

UI: grid with filters (q input debounce 300ms, chips category/size/condition, range price_min/max, select sort), pagination `page`/`limit` (infinite scroll = increment `page` until `totalPages`). Show `price` with discount: `discounted = Math.round(price - price*discount/100)`.

Deprecated PT `/produtos` hidden — do not use.

### 5.2 `GET /products/:id`
`Public`, `ParseUUIDPipe` → 404 `NOT_FOUND` if not found.

### 5.3 `GET /categories`
`Public`, cache 60s (`cache:categories`).
Response `{ data: [{category:"SUITS", total:10}] }` — includes **all** 4 categories even with `total:0` (via `Object.values(Category)` + `groupBy`).

### 5.4 `GET /delivery-zones`
`Public`, cache 60s (`cache:delivery-zones`).
Response `{ data: [{id, neighborhood:"Talatona", price:2500}] }` ordered by `neighborhood asc`. Seed with 16 neighborhoods.

Use these two to populate filters and checkout (calculate `deliveryFee`).

---

## 6. Addresses — `GET|POST|PATCH|DELETE /profile/addresses`

**Auth:** `JWT` (buyer). Ownership: `buyerId !== user.sub` → 404.

| Method | Route | Body | Response |
|--------|------|------|----------|
| GET | `/profile/addresses` | - | `200 {data: Address[]}` |
| POST | `/profile/addresses` | `CreateAddressDto` | `201 {data: Address}` |
| PATCH | `/profile/addresses/:id` | `UpdateAddressDto` | `200 {data}` |
| DELETE | `/profile/addresses/:id` | - | `200 {message}` |
| PATCH | `/profile/addresses/:id/default` | - | `200 {data}` |

Deprecated PT `perfil/enderecos` hidden.

**DTO `CreateAddressDto` (`src/modules/addresses/dto/create-address.dto.ts:19`) – English-only in Swagger (`@ApiPropertyOptional` English visible, PT hidden via `@ApiHideProperty` `create-address.dto.ts:27,41,55,69,83,96`):**

| Field (English – **visible** in Swagger) | Type | Required | Validation | Legacy PT alias (`@ApiHideProperty` – **hidden** from Swagger) |
|-------|------|----------|------------|---------------------------------------------------------------|
| `label` | string | POST yes | `IsString IsNotEmpty Trim` | `etiqueta` hidden |
| `province` | string | POST yes | `IsString IsNotEmpty Trim` | `provincia` hidden |
| `municipality` | string | POST yes | `IsString IsNotEmpty Trim` | `municipio` hidden |
| `neighborhood` | string | POST yes | `IsString IsNotEmpty Trim` | `bairro` hidden |
| `street` | string | POST yes | `IsString IsNotEmpty Trim` | `rua` hidden |
| `reference` | string? | no | `IsString Trim` free text | `referencia` hidden |
| `latitude` | number? | no | `IsNumber Min -90 Max 90` | — |
| `longitude` | number? | no | `IsNumber Min -180 Max 180` | — |

> Swagger at `https://api-sadivacloset.himersus.com/api/docs` shows only `label`/`province`/`municipality`/`neighborhood`/`street`/`reference`/`latitude`/`longitude`. PT aliases (`etiqueta`, `provincia`, `municipio`, `bairro`, `rua`, `referencia`) are `@ApiHideProperty` – hidden but still accepted via `labelNormalized`/`provinceNormalized` etc. for compat. Frontend MUST send English.

`UpdateAddressDto` same fields but all optional; controller requires `hasAny` else 400 `No fields to update`.

**Rules `AddressesService`:**
- `create`: `isDefault = (count where buyerId ===0)` — first address auto-default.
- `update`: owner only.
- `remove`: if single address and has `Delivery where addressId and order.buyerId in [AWAITING_PAYMENT, PAID, PREPARING, SHIPPING]` → 400 `ADDRESS_IN_USE`. If it was `isDefault` and others remain, promote smallest `id` to `isDefault true`.
- `setDefault`: transaction `updateMany isDefault false` + `update id true`.

**Response `Address` (English-only):**
```json
{ "id":"uuid","buyerId":"uuid",
  "label":"Home","province":"Luanda",
  "municipality":"Talatona",
  "neighborhood":"Talatona","street":"Street 123",
  "reference":null,"latitude":null,"longitude":null,"isDefault":true }
```

**Implementation:**
```ts
async function listAddresses(){ const {data}=await api.get('/profile/addresses'); return data.data; }
async function createAddress(payload: {label:string, province:string, municipality:string, neighborhood:string, street:string, reference?:string, latitude?:number, longitude?:number}){
  const {data}=await api.post('/profile/addresses', payload); return data.data;
}
async function setDefaultAddress(id:string){ const {data}=await api.patch(`/profile/addresses/${id}/default`); return data.data; }
```

UI: list addresses with badge “Default”, CRUD form, button “Make default”. If DELETE 400 `ADDRESS_IN_USE`, show “Cannot remove address with pending orders”.

---

## 7. Cart — `GET|POST|PATCH|DELETE /cart`

**Auth:** `JWT` buyer (`@ApiBearerAuth`). Deprecated PT `carrinho` hidden.

| Method | Route | Body | Response |
|--------|------|------|----------|
| GET | `/cart` | - | `200 {data:{items,subtotal,totalItems,totalQuantity}}` — each item enriched |
| POST | `/cart/items` | `{productId, quantity}` | `201 {data: CartItem}` |
| PATCH | `/cart/items/:id` | `{quantity}` | `200 {data}` |
| DELETE | `/cart/items/:id` | - | `200 {message:"Item removed..."}` |

**DTO `AddCartItemDto` (`src/modules/cart/dto/add-cart-item.dto.ts:5`) – English-only in Swagger (`@ApiProperty` English visible, PT hidden via `@ApiHideProperty` `add-cart-item.dto.ts:11,16,28`):**
```json
{ "productId": "550e8400-e29b-41d4-a716-446655440000", "quantity": 2 }
```
English fields: `productId` (`@ApiProperty`), `quantity` (`@ApiPropertyOptional`). Legacy PT aliases `produto_id`/`product_id`/`quantidade` are `@ApiHideProperty` – **hidden** from `https://api-sadivacloset.himersus.com/api/docs` but still accepted via `productIdNormalized`/`quantityNormalized` for compat. Frontend MUST send `{ "productId": "uuid", "quantity": 2 }` not `{ "produto_id": "uuid", "quantidade": 2 }`.

`quantity >=1` else 400 `VALIDATION_ERROR`. `productId` must be UUID v4.

**Rules `CartService`:**
- `getCart`: `findMany where buyerId include product`, calculates `unit = round(price - price*discount/100)`, `subtotal = unit*quantity`, `total = sum`, `totalItems = count`, `totalQuantity = sum quantity`.
- `addItem`: validates `product exists` → 404 `NOT_FOUND`; if `quantity > stock` → 400 `INSUFFICIENT_STOCK {available, requested}`; if `CartItem` exists → `new = existing.quantity+quantity`, validates `>stock` → 400 with `available, inCart, requested, total`, else `update`; else `create`.
- `updateItem`: `:id` is `CartItem.id` (not `productId`!) — validates owner → 404 `NOT_FOUND`; validates `quantity>stock` → 400.
- `removeItem`: validates owner → 404, `delete`.

**Response `GET /cart` (English-only):**
```json
{
  "data": {
    "items": [{ "id":"cartItemId","productId":"prodId","quantity":2,
                "product": { "id":"...","name":"...", "price":45000, "discount":10 }, "discountedPrice":40500, "subtotal":81000 }],
    "subtotal": 81000, "totalItems":1, "totalQuantity":2
  }
}
```

**Implementation:**
```ts
async function getCart(){ const {data}=await api.get('/cart'); return data.data; }
async function addToCart(productId:string, quantity:number){ const {data}=await api.post('/cart/items',{productId, quantity}); return data.data; }
async function updateCartItem(cartItemId:string, quantity:number){ const {data}=await api.patch(`/cart/items/${cartItemId}`,{quantity}); return data.data; }
async function removeCartItem(cartItemId:string){ await api.delete(`/cart/items/${cartItemId}`); }
```

UI: cart icon with badge `totalQuantity`, drawer/list with qty stepper (PATCH), remove (DELETE). If 400 `INSUFFICIENT_STOCK`, show `available` in toast. `POST` is idempotent — can be called multiple times, sums.

---

## 8. Checkout — `POST /checkout` (core flow)

**Auth:** `JWT`, `@Throttle checkout 10/min`.

**Body `CheckoutDto` (`src/modules/checkout/dto/checkout.dto.ts:7`) – English-only in Swagger (`@ApiPropertyOptional` English visible, PT hidden via `@ApiHideProperty` `checkout.dto.ts:16,21,31,36,54,68,73,85,92`):**

```json
{
  "type": "HOME_DELIVERY",
  "scheduledDate": "2026-09-01",
  "timeWindow": "09:00-12:00",
  "addressId": "550e8400-e29b-41d4-a716-446655440000",
  "deliveryZoneId": "550e8400-e29b-41d4-a716-446655440001"
}
```
Use `type` = `HOME_DELIVERY` or `STORE_PICKUP` (English). Legacy `tipo`, `data_agendada`/`scheduled_date`, `janela_horario`/`time_window`, `endereco_id`/`address_id`, `zona_entrega_id`/`delivery_zone_id` are `@ApiHideProperty` – **hidden** from `https://api-sadivacloset.himersus.com/api/docs` but still accepted via `typeNormalized`/`scheduledDateNormalized`/`timeWindowNormalized`/`addressIdNormalized`/`deliveryZoneIdNormalized` for compat. Frontend MUST send English above not PT.

**Controller validations:**
- if `!type` → 400 `type is required (HOME_DELIVERY | STORE_PICKUP)`
- if `type` not in `HOME_DELIVERY|STORE_PICKUP` → 400
- if `!scheduledDate` → 400 `scheduledDate is required (YYYY-MM-DD)`
- if `!timeWindow` → 400

> Do not use PT aliases (`tipo`/`data_agendada`/`janela_horario`/`endereco_id`) – they are hidden in Swagger and deprecated, though runtime still maps them via getters.

**Rules `CheckoutService.checkout()`:**
1. `cartItems where buyerId include product` → if empty → 400 `CART_EMPTY`.
2. Normalize `deliveryType`: `HOME_DELIVERY`/`STORE_PICKUP`, else 400.
3. Validate `scheduledDate` is valid `Date` and `>= today (midnight UTC)` else 400 `cannot be in the past`.
4. Validate `timeWindow` trimmed not empty.
5. Resolve `addressId, deliveryFee` **outside transaction**:
   - `STORE_PICKUP`: `addressId=null, deliveryFee=0`
   - `HOME_DELIVERY` + `addressId`: validate `address owner` → 404 `NOT_FOUND`; if `deliveryZoneId` → validate `DeliveryZone` → 404 and `fee=zone.price`; else try `DeliveryZone where neighborhood=address.neighborhood` → if exists fee, else `AdminPreferences.defaultDeliveryFee` (2500 seed / fallback 3000).
   - Only `deliveryZoneId` (without address): same validation fee=zone.price.
   - None: try `Address where buyerId isDefault true` → if exists resolve zone by neighborhood fallback prefs; else prefs.
6. **Transaction `prisma.$transaction`:**
   - For each `cartItem`: `product where id` → 404 `Product not found: id`; if `stock < quantity` → 400 `INSUFFICIENT_STOCK` with `productId, name, available, requested`; calculate `unitDiscounted`, accumulate `subtotal`, create `orderItemsData`; decrement `product.stock` via `updateMany where id stock>=quantity data stock decrement quantity` — if `count===0` → 400 `INSUFFICIENT_STOCK`.
   - `total = subtotal + deliveryFee`
   - `order.create` with `buyerId, subtotal, deliveryFee, total, status=AWAITING_PAYMENT`, `items.create`, `delivery.create {type, addressId, scheduledDate, timeWindow, status=SCHEDULED, deliveryFee}`
   - `cartItem.deleteMany where buyerId` (empties cart)
7. Returns `Order` English-only with `id, buyerId, subtotal, deliveryFee, total, status, createdAt, items, delivery`.

**Response 201 (English-only):**
```json
{ "data": {
  "id":"orderUuid",
  "buyerId":"buyerId","subtotal":81000,"deliveryFee":2500,"total":83500,
  "status":"AWAITING_PAYMENT","createdAt":"2026-01-03T00:00:00.000Z",
  "items":[{ "id":"...", "productId":"...", "productName":"Black Suit","unitPrice":45000,"discount":10,"quantity":2 }],
  "delivery": { "id":"...","type":"HOME_DELIVERY","addressId":"...","scheduledDate":"2026-09-01","timeWindow":"09:00-12:00","status":"SCHEDULED","deliveryFee":2500 }
} }
```

**Implementation:**
```ts
async function checkout(payload:{ type:'HOME_DELIVERY'|'STORE_PICKUP', scheduledDate:string, timeWindow:string, addressId?:string, deliveryZoneId?:string }){
  const {data}=await api.post('/checkout', payload);
  return data.data;
}
// Example home delivery with default address:
await checkout({ type:'HOME_DELIVERY', scheduledDate:'2026-09-05', timeWindow:'09:00-12:00', addressId });
// Store pickup (no fee):
await checkout({ type:'STORE_PICKUP', scheduledDate:'2026-09-06', timeWindow:'14:00-17:00' });
```

UI: checkout page with radio `HOME_DELIVERY` (shows address + zones select, date picker min today, window select 09-12/12-15/15-18) vs `STORE_PICKUP` (only date/window). On submit, if 429 `RATE_LIMIT_EXCEEDED` show “Try in 60s”. If 400 `INSUFFICIENT_STOCK`, go back to cart highlighting product. Success → redirect `/orders/:id` with `AWAITING_PAYMENT`.

---

## 9. Orders — `GET /orders/:id`, `PATCH /orders/:id/cancel`, `POST /orders/:id/delivery`, `GET /profile/orders`

**Auth:** `JWT` owner. `order.buyerId !== user.sub` → 404 `NOT_FOUND` (IDOR 404 not 403).

| Method | Route | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/orders/:id` | JWT owner | - | `200 {data: OrderDetail}` |
| PATCH | `/orders/:id/cancel` | JWT owner | - | `200 {data: OrderDetail}` + restores stock |
| POST | `/orders/:id/delivery` | JWT owner | `UpdateDeliveryDto` | `200 {data: OrderDetail}` creates/updates delivery |
| GET | `/profile/orders` | JWT | `?page&limit` | `200 { data, page, total, totalPages }` |

Deprecated PT `/pedidos/*`, `GET /perfil/pedidos` hidden.

**`OrderDetail` (English-only via `OrdersService.toOrderResponse`):**
```json
{
  "id":"uuid","buyerId":"uuid",
  "subtotal":81000,"deliveryFee":2500,"total":83500,
  "status":"AWAITING_PAYMENT","createdAt":"2026-01-03T00:00:00.000Z",
  "items":[{ "id":"...","productId":"...","productName":"...","unitPrice":45000,"discount":10,"quantity":2 }],
  "delivery": { "id":"...","orderId":"...","type":"HOME_DELIVERY","addressId":"...","scheduledDate":"2026-09-01","timeWindow":"09:00-12:00","status":"SCHEDULED","deliveryFee":2500,"instructions":null },
  "payment": { "id":"...","method":"BANK_TRANSFER","amount":83500,"status":"PENDING","externalReference":"15chars","receiptUrl":null }
}
```

**Rules `cancel`:**
- If `status===CANCELLED` → 400 `ORDER_ALREADY_CANCELLED`
- If `status===COMPLETED` → 400 `ORDER_NOT_CANCELLABLE`
- If `delivery.status in ON_THE_WAY, DELIVERED` or `order.status==SHIPPING` → 400 `DELIVERY_IN_PROGRESS` (message: “in transit / shipping”)
- If `delivery.status==CANCELLED` → 400 `DELIVERY_ALREADY_CANCELLED`
- Transaction restores `product.stock += quantity`, `order.status=CANCELLED`, `delivery.status=CANCELLED`.

**Rules `upsertDelivery` (`UpdateDeliveryDto` `src/modules/orders/dto/update-delivery.dto.ts:7` – English-only in Swagger `@ApiPropertyOptional` visible, PT hidden via `@ApiHideProperty` `update-delivery.dto.ts:16,21,36,41,53,60,73`):**
```ts
{ addressId?: string, scheduledDate?: "2026-09-10", timeWindow?: "09:00-12:00", instructions?: string }
```
English: `addressId`, `scheduledDate`, `timeWindow`, `instructions`. Legacy PT aliases `endereco_id`/`address_id`/`enderecoId`, `data_agendada`/`scheduled_date`, `janela_horario`/`time_window`, `instrucoes` are `@ApiHideProperty` – **hidden** from `https://api-sadivacloset.himersus.com/api/docs` but still accepted via `addressIdNormalized`/`scheduledDateNormalized`/`timeWindowNormalized`/`instructionsNormalized`. Frontend MUST send English above.
- If `order.status==CANCELLED` → 400 `ORDER_CANCELLED`.
- Validate `addressId` owner → 404.
- Validate `scheduledDate` valid and not in past.
- Validate `timeWindow` not empty.
- If `!order.delivery` requires `scheduledDate && timeWindow` else 400.
- If `delivery.status in ON_THE_WAY, DELIVERED` → 400 `DELIVERY_IN_PROGRESS`, block edit.

**`GET /profile/orders` + pagination**
Uses `OrdersService.findAllPaginated` and `AdminOrdersService` (admin sees all). For buyer, call `/profile/orders?page=1&limit=10`.

**Implementation:**
```ts
async function getOrder(id:string){ const {data}=await api.get(`/orders/${id}`); return data.data; }
async function cancelOrder(id:string){ const {data}=await api.patch(`/orders/${id}/cancel`); return data.data; }
async function updateDelivery(id:string, payload: {addressId?:string, scheduledDate?:string, timeWindow?:string, instructions?:string}){ const {data}=await api.post(`/orders/${id}/delivery`, payload); return data.data; }
async function listMyOrders(page=1,limit=10){ const {data}=await api.get('/profile/orders',{params:{page,limit}}); return data; }
```

UI: orders list with badge status (colors by `OrderStatus`), detail with timeline items+delivery+payment, Cancel button (disabled if `DELIVERY_IN_PROGRESS` etc), Edit Delivery form.

---

## 10. Payments — `POST /orders/:id/payment/init`, `GET /orders/:id/payment`, `POST /orders/:id/payment/receipt` ⭐ JSON URL only

**Auth:** `JWT` owner. Deprecated PT `/pedidos/:id/pagamento/iniciar`, `/pedidos/:id/pagamento/comprovativo` hidden.

| Method | Route | Body | Response |
|--------|------|------|----------|
| POST | `/orders/:id/payment/init` | `{method, phoneNumber?, iban?, description?}` | `201 {data: Payment}` |
| GET | `/orders/:id/payment` | - | `200 {data: Payment}` |
| POST | `/orders/:id/payment/receipt` | `JSON { receiptUrl }` | `200 {data: Payment}` — **NOT multipart**. Frontend sends only URL |
| GET | `/payments/history` | `?page&limit&type=credit|debit` | `200 { data, page, total, totalPages }` |
| GET | `/wallet/history` | `?page&limit` | `200 { data, page, total, totalPages }` |

### 10.1 `POST .../payment/init` — Initiate payment
**Body `InitiatePaymentDto` (`src/modules/payments/dto/iniciar-pagamento.dto.ts:7`) – English-only in Swagger (`@ApiProperty`/`@ApiPropertyOptional` English visible, PT hidden via `@ApiHideProperty` `iniciar-pagamento.dto.ts:15,30,50`):**
```ts
{ method: string, phoneNumber?: string, iban?: string, description?: string, expiresInSeconds?: number }
```
English: `method` (`@ApiProperty`), `phoneNumber`, `iban`, `description` (`@ApiPropertyOptional`). Legacy PT aliases `metodo`, `telefone`, `descricao` are `@ApiHideProperty` – **hidden** from `https://api-sadivacloset.himersus.com/api/docs` but still accepted via `@Transform(({ obj }) => obj.method ?? obj.metodo)` / `phoneNormalized` / `descriptionNormalized`. Frontend MUST send English:

```json
{ "method": "BANK_TRANSFER", "phoneNumber": "923456789", "description": "Order #123" }
```
Do **not** send `{ "metodo": "transferencia", "telefone": "923456789", "descricao": "Pedido #123" }` – PT fields are hidden.

**Receipt `POST .../payment/receipt` body (English-only):**
```json
{ "receiptUrl": "https://cdn.myapp.com/receipts/abc.jpg" }
```
Only `receiptUrl` (`@ApiProperty`). Legacy `comprovativo_url` is hidden – do not use.
**`method` accepts (via `mapMethodToEnum`):**
- `multicaixa_express` / `gpo` / `multicaixa express` → `MULTICAIXA_EXPRESS`
- `multicaixa_reference` / `reference` / `gpr` → `MULTICAIXA_REFERENCE`
- `bank_transfer` → `BANK_TRANSFER`
- `cash_on_delivery` → `CASH_ON_DELIVERY`
- `card` → `CARD`
- `kwik` → `BANK_TRANSFER` (via E-Kwanza KWiK payout)

> Legacy PT values `transferencia`, `pagamento_entrega`, `cartao`, `referencia` still accepted by backend for compat, but frontend MUST send English `method` values above (or `bank_transfer`, etc.).

**Validations:**
- `method` invalid → 400 `INVALID_METHOD` with valid list.
- If `method==MULTICAIXA_EXPRESS` and `!phoneNumber` → 400 `VALIDATION_ERROR phoneNumber required for GPO`.
- If `iban` with non-transfer method → accepted but ignored (only `kwik` uses `SendKWiKToCustomer`).

**Rules `PaymentsService.initiate`:**
- Validate `order exists && buyerId` → 404 `NOT_FOUND`
- If `order.status==CANCELLED` → 400 `ORDER_CANCELLED`
- If `order.status in PAID|COMPLETED` → 400 `ORDER_ALREADY_PAID`
- If `payment.status==PAID` → 400 `PAYMENT_ALREADY_VALIDATED`
- Resolve `method` via `mapMethodToEnum`
- If payment already `PENDING/PROCESSING` and `method` different, **update method** (idempotent)
- If no payment, create `payment {orderId, method, amount: order.total, status: isGatewayMethod?PROCESSING:PENDING, phoneNumber, iban}` + `walletTransaction {type:credit, amount, status:pending, referenceType:payment_intent, referenceId: payment.id}`
- If `isGatewayMethod (GPO/GPR)`: generate `merchantTxId` 15 chars via `randomUUID+sha256->base36`, `providerTxId = deriveMerchantTxId`, update `externalReference, providerTxId, bridpayMerchantTxId, providerDetails:{provider:local, method:gpo|gpr}`
- If `iban && method==kwik`: generate `merchantTxId`, if `EKWANZA_*` configured call `ekwanza.sendKwikToCustomer({iban, amount, operationCode})` and create `Payout` + `WalletTransaction debit` + update `payment`; else mock local + `logger.warn`.
- If `BANK_TRANSFER + iban + method!=kwik`: create `Payout PENDING` simple.

**Response `Payment` (English-only):**
```json
{ "id":"uuid","orderId":"uuid",
  "method":"BANK_TRANSFER","amount":83500,
  "status":"PENDING",
  "externalReference":"abc123...","receiptUrl":null,
  "providerTxId":null,
  "phoneNumber":null,"iban":null,
  "createdAt":"2026-01-03T00:00:00.000Z","updatedAt":"2026-01-03T00:00:00.000Z" }
```

**Implementation:**
```ts
async function initPayment(orderId:string, payload:{ method:string, phoneNumber?:string, iban?:string, description?:string }){
  const {data}=await api.post(`/orders/${orderId}/payment/init`, payload);
  return data.data;
}
// Examples:
await initPayment(orderId, { method:'BANK_TRANSFER' });
await initPayment(orderId, { method:'MULTICAIXA_EXPRESS', phoneNumber:'923456789' });
await initPayment(orderId, { method:'BANK_TRANSFER', iban:'AO06004400006729503010148', description:'KWIK payout kwik' }); // with iban for kwik flow use method kwik or description kwik
await initPayment(orderId, { method:'kwik', iban:'AO06004400006729503010148', description:'KWIK payout' });
```

### 10.2 `POST .../payment/receipt` — Send receipt (URL, not file)
> **IMPORTANT vs old docs:** previously `multipart/form-data file 5MB` + `GET /uploads/<file>`. **Now frontend hosts** the image (S3, Cloudinary, Vercel Blob, Supabase Storage) and **sends only JSON with URL**. Backend does not store file, only saves `receiptUrl` string and changes `status=PROCESSING`.

**Request (English-only):**
```http
POST /api/v1/orders/:id/payment/receipt
Authorization: Bearer <token>
Content-Type: application/json

{ "receiptUrl": "https://cdn.myapp.com/receipts/abc.jpg" }
```

**Backend (`PaymentsService.receipt`):**
- Validate `order owner` → 404
- If `!order.payment` → 404 `Payment not initiated. Use POST /orders/:id/payment/init first`
- If `payment.status==PAID` → 400 `PAYMENT_ALREADY_VALIDATED`
- Save `payment.receiptUrl = receiptUrl`, `status=PROCESSING` (awaiting admin validation or webhook), create `WalletTransaction credit pending`.

**Validate URL on frontend:** `IsUrl` + logical size (do not send huge base64). If 5MB limit needed, validate before external upload.

**Example frontend (Cloudinary):**
```ts
async function uploadToCloudinary(file: File): Promise<string>{
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', 'sadiva_preset');
  const {data} = await axios.post('https://api.cloudinary.com/v1_1/<cloud>/image/upload', fd);
  return data.secure_url; // https://res.cloudinary.com/.../image.jpg
}
async function sendReceipt(orderId:string, file: File){
  const url = await uploadToCloudinary(file); // 1) host
  const {data} = await api.post(`/orders/${orderId}/payment/receipt`, { receiptUrl: url }); // 2) send only URL
  return data.data;
}
// Alternative S3 presigned:
async function sendReceiptS3(orderId:string, s3Url:string){
  await api.post(`/orders/${orderId}/payment/receipt`, { receiptUrl: s3Url });
}
```

**Error if sending old `multipart`:** `ValidationPipe` with `whitelist` will reject `file` field → 400 `VALIDATION_ERROR`.

### 10.3 `GET .../payment` + Histories
- `GET /orders/:id/payment` → returns `Payment` or 404 `Payment not found for this order`.
- `GET /payments/history?type=credit|debit&page&limit` → `PaginatedResponse<WalletTransaction>` filtered by `buyerId` via `orderIds`. `type`: `credit` / `debit`.
- `GET /wallet/history?page&limit` → `{ data, page, total, totalPages }`.

> Deprecated PT `GET /payments/historico`, `/payments/entradas`, `/payments/saidas`, `/payments/carteira/historico`, `/pagamentos/historico` hidden – use English `history`.

**WalletTransaction (English-only):**
```json
{ "id":"...","type":"credit","amount":83500,"status":"settled", "referenceType":"payment_intent","orderId":"...","paymentId":"...","createdAt":"2026-01-03T00:00:00.000Z" }
```

---

## 11. Wallet & Payouts (internal, frontend read-only)

- `WalletTransaction` is internal ledger: `credit` (entries: payments initiated, receipts, validations, webhooks), `debit` (exits: KWiK).
- `Payout` created when `kwik`/`bank_transfer+iban` → `status PENDING→PROCESSING→PAID` via webhook E-Kwanza.
- Frontend only consumes `GET /payments/history` and `GET /wallet/history` to show statement.

---

## 12. Webhooks — gateway only, frontend NEVER calls (but understand)

| Canonical EN | Alias PT hidden | Auth | HMAC Header |
|--------------|-----------------|------|-------------|
| `POST /webhooks/payment/:gateway` | `POST /webhooks/pagamento/:gateway` | Public | `x-signature` |
| `POST /webhooks/bridpay` | `POST /webhooks/pagamentos/bridpay` | Public | `x-signature` |
| `POST /webhooks/appypay` | — | Public | `x-signature` |
| `POST /webhooks/ekwanza` | — | Public | `x-signature` |

**Gateway param:** `appypay|ekwanza|generic|bridpay|gpo|gpr|kwik`
**Env:** `PAYMENT_WEBHOOK_SECRET` generic or `PAYMENT_WEBHOOK_SECRET_<GATEWAY>` (e.g., `PAYMENT_WEBHOOK_SECRET_APPYPAY`). If empty, HMAC is skipped (dev only, `logger.warn`).

**Generate signature (Node):**
```js
const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
// header: 'x-signature: ' + sig  or 'sha256=' + sig
// alternative: update(rawBody string exact) — both tried
```

**Generic payload (English-only):**
```json
{ "externalReference": "merchant-tx-id-15chars", "status": "paid", "amount": 50000 }
```
`status` accepts `paid|settled|success|confirmed|approved` → `Payment PAID`, `Order PAID`, `WalletTransaction settled`, buyer notified, enqueues `BullMQ payment-confirmed`. `failed|rejected|cancelled` → `FAILED`. Missing `externalReference` → 400 `MISSING_REFERENCE`. Missing `x-signature` when secret → 400 `MISSING_SIGNATURE`, invalid → 400 `INVALID_SIGNATURE`.

**Idempotency:** `externalReference` is key — `Redis SET webhook:payment:${gateway}:${ref} EX 7d` + `webhookProcessedAt`. 2nd call → `200 { ok:true, idempotent:true, message:"Already processed" }`.

**E-Kwanza webhook specific:** payload `{ code, operationCode, status }`, HMAC = `HMAC_SHA256( code+operationCode+registrationNumber+token, apiKey)` via `EKWANZA_API_KEY`.

**Frontend:** never call webhooks. Only poll `GET /orders/:id` or `GET /orders/:id/payment` until `PAID` after gateway confirmation.

---

## 13. Favorites — `GET|POST|DELETE /profile/favorites`

**Auth:** `JWT` buyer. Deprecated PT `perfil/favoritos` hidden.

| Method | Route | Params | Response |
|--------|------|--------|----------|
| GET | `/profile/favorites` | - | `200 {data: Product[]}` |
| POST | `/profile/favorites/:productId` | `productId UUID` | `201 {data: Product}` (idempotent, upsert) |
| DELETE | `/profile/favorites/:productId` | `productId UUID` | `200 {message:"Removed..."}` (idempotent, deleteMany) |

**Rules:** `POST` validates `product exists` → 404 `NOT_FOUND`; `DELETE` never 404, always 200 even if not favorite.

**Implementation:**
```ts
async function listFavorites(){ const {data}=await api.get('/profile/favorites'); return data.data; }
async function addFavorite(productId:string){ const {data}=await api.post(`/profile/favorites/${productId}`); return data.data; }
async function removeFavorite(productId:string){ await api.delete(`/profile/favorites/${productId}`); }
```

UI: heart toggle, wishlist grid.

---

## 14. Notifications — `GET /profile/notifications`, `PATCH .../read`

**Auth:** `JWT` buyer. Deprecated PT `perfil/notificacoes` hidden. Generated automatically: `AdminOrders.updateStatus`, `AdminDeliveries.updateStatus`, `Payments.validateAdmin` (admin validates), `Webhooks` (payment confirmed), `Queue` enqueues.

| Method | Route | Response |
|--------|------|----------|
| GET | `/profile/notifications` | `200 {data: Notification[]}` |
| PATCH | `/profile/notifications/read` | `200 {data:{count}, message:"All marked..."}` |
| PATCH | `/profile/notifications/:id/read` | `200 {data: Notification}` |

**Important:** `/read` before `/:id/read` to avoid capturing as `:id`.

**`Notification` (English-only):**
```json
{ "id":"uuid","title":"Payment confirmed","description":"Payment for order #abc was confirmed","createdAt":"2026-01-03T00:00:00.000Z","isRead":false,"buyerId":"..." }
```
Errors: `:id` not owned → 404 `NOT_FOUND`.

**Implementation:**
```ts
async function listNotifications(){ const {data}=await api.get('/profile/notifications'); return data.data; }
async function markRead(id:string){ const {data}=await api.patch(`/profile/notifications/${id}/read`); return data.data; }
async function markAllRead(){ const {data}=await api.patch('/profile/notifications/read'); return data.data; }
```

UI: bell with counter `isRead===false`, list with “Mark all as read”, badge.

---

## 15. Delivery & Admin — Overview

All ` /admin/*` require `Authorization: Bearer <adminToken>` + `role=admin`. No token → 401 `UNAUTHENTICATED`, buyer → 403 `FORBIDDEN` (via `RolesGuard isAdminPath`).

Deprecated PT hidden (`/admin/produtos`, `/admin/pedidos`, `/admin/entregas`, `/admin/estatisticas`, `/admin/loja`, `/admin/conta`, `/admin/preferencias`, `/admin/membros`, `/admin/auditoria`, `/admin/pagamentos`) — use EN.

### 15.1 Admin Products — `GET|POST|PATCH|DELETE /admin/products`
| Method | Route | DTO |
|--------|------|-----|
| GET | `/admin/products?q=&category=&page&limit` | `FilterProductsDto` (q, category, pagination) |
| POST | `/admin/products` | `CreateProductDto` |
| PATCH | `/admin/products/:id` | `UpdateProductDto` |
| DELETE | `/admin/products/:id` | - |

**`CreateProductDto` (English-only):**
```ts
{ image: url, name, description, category: Category, size, condition: ProductCondition, stock: int>=0, price: int>=0, discount?: 0..100 }
```
Errors `image must be a URL`, `category must be one of: SUITS...`. On create/update/delete, invalidates `cache:products:*`, `cache:categories` and records `audit`.

### 15.2 Admin Orders — `GET /admin/orders`, `PATCH /admin/orders/:id/status`
- `GET /admin/orders?status=&from=&to=&page&limit` — `FilterOrdersDto` with `status` (`AWAITING_PAYMENT|PAID|...`) + `from`/`to` (ISO, `to` set 23:59:59). Legacy PT query `estado`/`data_inicio`/`data_fim` still accepted by backend for compat but frontend MUST send English `status`/`from`/`to`.
- `PATCH /admin/orders/:id/status` — `UpdateOrderStatusDto {status}`. If invalid →400. If already equal returns. Else `order.update`, `audit`, `notifications.create` buyer “Order updated”.

### 15.3 Admin Deliveries — `GET /admin/deliveries`, `PATCH .../status`
Similar, `FilterDeliveriesDto` with `status` (`DeliveryStatus`) + `scheduledDate` range, `delivery.findMany include order,address`. `PATCH` validates `SCHEDULED|ON_THE_WAY|DELIVERED|FAILED|CANCELLED`. Legacy PT `estado` still accepted but deprecated.

### 15.4 Admin Statistics — `GET /admin/statistics`
**Query `QueryStatisticsDto` (extends PaginationDto):**
- `days: 1..365 default 30`, `from`, `to` (ISO).
- If `from+to` → `currentStart=from, currentEnd=to 23:59`, `previous = duration before`; if only `from` → `currentEnd= from+days`; else `currentEnd=now, currentStart=now-days`.
- Aggregates in parallel: `order.aggregate sum total` only `PAID/COMPLETED`, `product.count`, `user.count role BUYER`, `order.count`. `whereRecent` paginated.
- Helper `calcVariation(current,previous)` → `difference, percentage ((diff/prev)*100 fixed1), grew`.

**Response 200 (English-only):**
```json
{
  "totalRevenue": 100000,
  "revenue": { "value":30000,"previousValue":20000,"percentage":50,"grew":true,"totalValue":100000 },
  "totalProducts":50,"products": { "value":10,"previousValue":5,"percentage":100, "grew": true },
  "totalMembers":100, "totalOrders":80,
  "period": { "days":30,"from":"...","to":"...","previousFrom":"..." },
  "variation": { "revenue": {...}, "products": {...} },
  "recentOrders": { "data":[...],"page":1,"total":80,"totalPages":4 }
}
```

### 15.5 Admin Store — `GET|PATCH /admin/store`
- `GET /admin/store` → `StoreConfig {id:"singleton", name, contactEmail, phone, address}`. If null creates `SadivaCloset, contact@sadivacloset.co.ao, +244 900..., Luanda...`.
- `PATCH /admin/store` → `UpdateStoreDto {name 2..100, contactEmail @IsEmail, phone 8..20, address 5..500}` upsert + audit. Legacy PT `nome`/`morada`/`telefone` still accepted by backend but deprecated – send English.

### 15.6 Admin Account — `GET|PATCH /admin/account`
- `GET /admin/account` → `{id,name,email,role,createdAt,isActive}`
- `PATCH /admin/account` → `UpdateAccountDto {name 2..100, email @IsEmail, currentPassword, newPassword Min8..100}`. If `newPassword && !currentPassword` →400 `currentPassword is required`; `bcrypt.compare` →400 `CURRENT_PASSWORD_INCORRECT`; if `new==current` →400; if email duplicate →409 `EMAIL_ALREADY_EXISTS`; hash `bcrypt 10`.

### 15.7 Admin Preferences — `GET|PATCH /admin/preferences`
- `GET` → `{id, notifyNewOrders, notifyLowStock, notifyNewMessages, defaultDeliveryFee, activePaymentMethods}`. If null creates `true,true,true, 3000, [MULTICAIXA_EXPRESS, MULTICAIXA_REFERENCE, BANK_TRANSFER]` (seed 2500).
- `PATCH` → `UpdatePreferencesDto {notifyNewOrders boolean?, notifyLowStock, notifyNewMessages, defaultDeliveryFee int>=0, activePaymentMethods: PaymentMethod[]}` upsert + audit.

### 15.8 Admin Members — `GET /admin/members`, `GET /admin/members/:id/orders`
- `GET /admin/members?q=&page&limit` → `where role BUYER + OR name/email contains q` + `groupBy buyerId` for `totalOrders` and `totalSpent` (paid sum) vs `totalSpentGross` (all). Response → `{id,name,email,role,createdAt, isActive, totalOrders, totalSpent, totalSpentGross}` English-only.
- `GET /admin/members/:id/orders?page&limit` → validates `role BUYER` → 404 `NOT_FOUND`, lists member orders.

### 15.9 Admin Audit — `GET /admin/audit?entity=&from=&to=&page&limit`
`FilterAuditDto extends PaginationDto` with `entity`, `from`, `to` (ISO). `where entity lower trim + createdAt gte/lte`, `orderBy createdAt desc`, map `{id, adminId, action, entity, entityId, details, createdAt}`.

### 15.10 Admin Payments — `PATCH /admin/payments/:id/validate`, `GET /admin/payments/history`
- `PATCH /admin/payments/:id/validate` → validates admin, `payment.status==PAID` already returns; else `payment.update PAID`, `order.update PAID`, `audit validate_payment`, `WalletTransaction credit settled`, `notifications create` buyer “Payment validated”. Returns `{payment, order}`.
- `GET /admin/payments/history?method=&status=&page&limit` → `where method via mapMethodToEnum`, `status` via map, `include order`.

---

## 16. Health

| Method | Route | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | Public (excluded from prefix) | `200 {status:"ok", database:"up", timestamp}` |
| GET | `/` | Public (excluded) | `200 {name, status}` |

Use for liveness probe. Staging: `https://api-sadivacloset.himersus.com/health`, Local: `http://localhost:3001/health`.

---

## 17. Critical Flows — Step by Step (for AI to generate screens)

### Flow 1 — Buyer: Register → Login → Catalog → Favorite → Cart → Checkout → Payment → Receipt → Tracking

1. `POST /auth/register {name, email, password}` → 201 or 409. Then `POST /auth/login {email,password}` → store `access_token, refresh_token`.
2. `GET /products?q=&category=&page=1&limit=12` → grid. `GET /categories` and `GET /delivery-zones` for filters.
3. `POST /profile/favorites/:productId` on ❤️ click (idempotent). `GET /profile/favorites` for wishlist.
4. `GET /profile/addresses` → if empty, `POST /profile/addresses {label, province, municipality, neighborhood, street}`. Mark default if desired via `PATCH /profile/addresses/:id/default`.
5. `POST /cart/items {productId, quantity:1}` → if 400 `INSUFFICIENT_STOCK` show “Only X available”. `GET /cart` for drawer with `subtotal`, `totalQuantity`. `PATCH /cart/items/:cartItemId {quantity:2}` on stepper, `DELETE` on trash.
6. `POST /checkout {type:"HOME_DELIVERY", scheduledDate:"2026-09-10", timeWindow:"09:00-12:00", addressId, deliveryZoneId}` → if 429 show retry, if `CART_EMPTY` go back; success → `orderId`, cart emptied, `status=AWAITING_PAYMENT`.
7. `POST /orders/:orderId/payment/init {method:"BANK_TRANSFER"}` or `{method:"MULTICAIXA_EXPRESS", phoneNumber:"923..."}` or `{method:"kwik", iban:"AO06..."}` → receive `Payment` with `externalReference`.
8. **Receipt:** host image on external storage (`uploadToCloudinary` or S3) → get `https://...` → `POST /orders/:orderId/payment/receipt {receiptUrl: "https://..."}` → `status=PROCESSING`. Do NOT send `FormData`/`file` to backend.
9. Poll `GET /orders/:orderId` or `GET /orders/:orderId/payment` until `payment.status==PAID` (after admin validates via `PATCH /admin/payments/:id/validate` or generic webhook confirms). Show timeline `AWAITING_PAYMENT → PAID → PREPARING → SHIPPING → COMPLETED`.
10. Post-purchase: `GET /profile/orders?page=1` for history, `PATCH /orders/:id/cancel` if still `SCHEDULED`, `POST /orders/:id/delivery {scheduledDate, timeWindow}` to reschedule.

### Flow 2 — IDOR & Security (automated test)
- `buyer2` tries `GET /orders/:orderIdOfBuyer1` → 404 `NOT_FOUND` (not 403). Frontend must treat 404 as “not found or no permission”.
- `buyer` tries `GET /admin/products` without token → 401, with buyer token → 403 `FORBIDDEN`.

### Flow 3 — Admin: Create product → Manage orders → Statistics
1. Login admin (`admin@sadivacloset.local` / `Admin@123` seed). `GET /admin/products` paginated.
2. `POST /admin/products {image:"https://...", name:"...", description:"...", category:"SUITS", size:"M", condition:"NEW", stock:10, price:45000, discount:10}` → `discountedPrice` visible in catalog.
3. `PATCH /admin/products/:id {stock:0}` → catalog shows “Out of stock”, cache invalidated.
4. `GET /admin/orders?status=AWAITING_PAYMENT&page=1` → `PATCH /admin/orders/:id/status {status:"PAID"}` → buyer receives notification.
5. `GET /admin/statistics?days=30&page=1&limit=5` → dashboard with `revenue`, `products`, `members`, `recentOrders`.
6. `GET /admin/audit?entity=payment&page=1` → validation logs.

---

## 18. Frontend Implementation — Ready Recipes

### 18.1 Suggested folder structure
```
src/
  api/client.ts          // axios + interceptors
  api/auth.ts, products.ts, cart.ts, checkout.ts, orders.ts, payments.ts, addresses.ts, favorites.ts, notifications.ts, admin.ts
  stores/authStore.ts    // zustand/pinia
  hooks/usePagination.ts
  components/ ProductCard, CartDrawer, AddressForm, CheckoutForm, OrderTimeline
  pages/ login, register, catalog, product/[id], cart, checkout, orders, orders/[id], profile/addresses, favorites, notifications, admin/*
  utils/error.ts         // maps error.code -> message
  utils/pagination.ts    // helpers
```

### 18.2 `api/client.ts` — Axios with refresh + English-only unwrap
```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://api-sadivacloset.himersus.com/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

function getTokens(){ return { access: localStorage.getItem('access_token'), refresh: localStorage.getItem('refresh_token') }; }
function setTokens(a:string,r:string){ localStorage.setItem('access_token',a); localStorage.setItem('refresh_token',r); }

api.interceptors.request.use(c=>{
  const {access}=getTokens();
  if(access) c.headers.Authorization=`Bearer ${access}`;
  return c;
});

let refreshing: Promise<string>|null=null;
api.interceptors.response.use(r=>r, async err=>{
  const orig = err.config;
  if(err.response?.status===401 && !orig._retry){
    const {refresh}=getTokens();
    if(!refresh) { localStorage.clear(); location.href='/login'; return Promise.reject(err); }
    orig._retry=true;
    if(!refreshing) refreshing=axios.post(`${api.defaults.baseURL}/auth/refresh`,{refresh_token:refresh})
      .then(res=>{ setTokens(res.data.access_token, res.data.refresh_token); return res.data.access_token; })
      .catch(e=>{ localStorage.clear(); location.href='/login'; throw e; })
      .finally(()=> refreshing=null);
    const nt = await refreshing;
    orig.headers.Authorization=`Bearer ${nt}`;
    return api(orig);
  }
  // normalize – English-only
  const data = err.response?.data;
  const code = data?.error?.code;
  const message = data?.error?.message;
  const details = data?.error?.details;
  return Promise.reject({ code, message, details, status: err.response?.status, raw: err });
});

// English-only helpers
export const unwrapList = <T>(res:any): { items:T[], page:number, total:number, totalPages:number }=>{
  // res is axios response.data already = { data, page, total, totalPages }
  const data = res.data;
  const list = data.data;
  const page = data.page;
  const total = data.total;
  const totalPages = data.totalPages;
  return { items: list, page, total, totalPages };
};
export const unwrapItem = <T>(res:any): T => res.data.data as T;
export const getMessage = (res:any): string => res.data?.message ?? res.message ?? '';
```

**Usage:**
```ts
const { data } = await api.get('/products', { params: { page:1, limit:12 } });
const { items, page, total, totalPages } = unwrapList(data); // where data = axios response.data
// single
const product = unwrapItem(await api.get('/products/'+id));
```

### 18.3 Error & Validation Helpers (English-only)
```ts
export const handleApiError = (e:any, form?: { setErrors:(f:string,msg:string)=>void })=>{
  if(e.code==='VALIDATION_ERROR' && e.details){
    e.details.forEach((d:{field:string,errors:string[]})=> form?.setErrors(d.field, d.errors.join(', ')));
    return e.message;
  }
  if(e.code==='INSUFFICIENT_STOCK') return e.message + (e.details ? ` (Available: ${e.details[0]?.available ?? e.details.available})` : '');
  if(e.code==='RATE_LIMIT_EXCEEDED') return 'Too many requests. Please try again in a minute.';
  if(e.code==='UNAUTHENTICATED') return 'Session expired. Please log in.';
  if(e.code==='FORBIDDEN') return 'You do not have permission to access this resource.';
  if(e.code==='NOT_FOUND') return 'Not found.';
  return e.message ?? 'Unexpected error';
};
```

### 18.4 Example `api/products.ts`
```ts
export const listProducts = (p: Record<string,any>)=> api.get('/products',{params:p}).then(r=>r.data);
export const getProduct = (id:string)=> api.get(`/products/${id}`).then(r=> r.data.data);
export const listCategories = ()=> api.get('/categories').then(r=> r.data.data);
export const listDeliveryZones = ()=> api.get('/delivery-zones').then(r=> r.data.data);
```

### 18.5 Example `api/cart.ts` / `api/checkout.ts` / `api/orders.ts`
```ts
// cart
export const getCart = ()=> api.get('/cart').then(r=> r.data.data);
export const addToCart = (productId:string, quantity:number)=> api.post('/cart/items',{productId, quantity}).then(r=> r.data.data);
export const updateCartItem = (id:string, quantity:number)=> api.patch(`/cart/items/${id}`,{quantity}).then(r=> r.data.data);
export const removeCartItem = (id:string)=> api.delete(`/cart/items/${id}`).then(r=> r.data);

// checkout
export const checkout = (payload:{type:'HOME_DELIVERY'|'STORE_PICKUP', scheduledDate:string, timeWindow:string, addressId?:string, deliveryZoneId?:string})=> api.post('/checkout', payload).then(r=> r.data.data);

// orders
export const getOrder = (id:string)=> api.get(`/orders/${id}`).then(r=> r.data.data);
export const listMyOrders = (page=1,limit=10)=> api.get('/profile/orders',{params:{page,limit}}).then(r=> r.data);
export const cancelOrder = (id:string)=> api.patch(`/orders/${id}/cancel`).then(r=> r.data.data);
```

### 18.6 Guards Frontend
- **BuyerGuard:** if `!access_token` redirect `/login`; if `role !== BUYER && role !== ADMIN` block.
- **AdminGuard:** `const profile = await api.get('/profile'); if(profile.data.data.role !== 'ADMIN') redirect '/403'`. Or decode JWT `payload.role`.
- **CheckoutGuard:** if `cart empty` redirect `/cart`.

---

## 19. Reference Curls (copy for AI / Postman)

```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
# Local alternative: BASE=http://localhost:3001/api/v1

# Register
curl -X POST $BASE/auth/register -H "Content-Type: application/json" -d '{"name":"Buyer","email":"buyer@test.com","password":"BuyerPass123!"}'

# Login
curl -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"email":"buyer@test.com","password":"BuyerPass123!"}'
# -> { access_token, refresh_token }

# Profile
curl $BASE/profile -H "Authorization: Bearer $TOKEN"

# List products with filters (English-only)
curl "$BASE/products?q=Suit&category=SUITS&size=M&condition=NEW&price_min=10000&price_max=100000&sort=price_asc&page=1&limit=12"

# Categories / Zones
curl $BASE/categories
curl $BASE/delivery-zones

# Addresses (English-only)
curl $BASE/profile/addresses -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/profile/addresses -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"label":"Home","province":"Luanda","municipality":"Talatona","neighborhood":"Talatona","street":"Street 123"}'
curl -X PATCH $BASE/profile/addresses/<id>/default -H "Authorization: Bearer $TOKEN"

# Cart (English-only)
curl $BASE/cart -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/cart/items -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"productId":"<uuid>","quantity":2}'
curl -X PATCH $BASE/cart/items/<cartItemId> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"quantity":3}'
curl -X DELETE $BASE/cart/items/<cartItemId> -H "Authorization: Bearer $TOKEN"

# Checkout (English-only)
curl -X POST $BASE/checkout -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"HOME_DELIVERY","scheduledDate":"2026-09-10","timeWindow":"09:00-12:00","addressId":"<uuid>"}'
# Store pickup
curl -X POST $BASE/checkout -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"STORE_PICKUP","scheduledDate":"2026-09-10","timeWindow":"09:00-12:00"}'
# -> { data: { id: orderId } }

# Payments init (English-only)
curl -X POST $BASE/orders/<orderId>/payment/init -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"method":"BANK_TRANSFER"}'
curl -X POST $BASE/orders/<orderId>/payment/init -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"method":"MULTICAIXA_EXPRESS","phoneNumber":"923456789"}'
curl -X POST $BASE/orders/<orderId>/payment/init -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"method":"kwik","iban":"AO06004400006729503010148"}'

# Receipt – JSON URL only (frontend already hosted)
curl -X POST $BASE/orders/<orderId>/payment/receipt -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"receiptUrl":"https://res.cloudinary.com/demo/image/upload/receipt.jpg"}'

# Orders
curl $BASE/orders/<orderId> -H "Authorization: Bearer $TOKEN"
curl "$BASE/profile/orders?page=1&limit=10" -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/orders/<orderId>/cancel -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/orders/<orderId>/delivery -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"scheduledDate":"2026-09-12","timeWindow":"14:00-17:00"}'

# Favorites
curl $BASE/profile/favorites -H "Authorization: Bearer $TOKEN"
curl -X POST $BASE/profile/favorites/<productId> -H "Authorization: Bearer $TOKEN"
curl -X DELETE $BASE/profile/favorites/<productId> -H "Authorization: Bearer $TOKEN"

# Notifications
curl $BASE/profile/notifications -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/profile/notifications/<id>/read -H "Authorization: Bearer $TOKEN"
curl -X PATCH $BASE/profile/notifications/read -H "Authorization: Bearer $TOKEN"

# Wallet (English-only)
curl "$BASE/payments/history?page=1&limit=20&type=credit" -H "Authorization: Bearer $TOKEN"
curl "$BASE/wallet/history?page=1&limit=20" -H "Authorization: Bearer $TOKEN"

# Admin (admin token)
curl $BASE/admin/products -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST $BASE/admin/products -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"image":"https://cdn.com/a.jpg","name":"Black Suit","description":"...","category":"SUITS","size":"M","condition":"NEW","stock":10,"price":45000,"discount":10}'
curl -X PATCH $BASE/admin/orders/<orderId>/status -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"status":"PAID"}'
curl "$BASE/admin/statistics?days=30&page=1&limit=5" -H "Authorization: Bearer $ADMIN_TOKEN"

# Webhook (gateway, not frontend) — HMAC example (English payload)
PAYLOAD='{"externalReference":"abc123def456ghi","status":"paid"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | cut -d' ' -f2)
curl -X POST $BASE/webhooks/payment/generic -H "x-signature: $SIG" -H "Content-Type: application/json" -d "$PAYLOAD"
```

---

## 20. Checklist for AI — Before Marking as Done

- [ ] `api/client.ts` with `baseURL https://api-sadivacloset.himersus.com/api/v1` (fallback `http://localhost:3001/api/v1`), `Authorization Bearer`, interceptor refresh `POST /auth/refresh` with `{refresh_token}`, `handleApiError` showing `error.message` and `error.code`.
- [ ] Pages: `/login`, `/register`, `/forgot-password`, `/reset-password?token=`, `/profile` (GET/PATCH), `/` catalog with filters `q,category,size,condition,price_min,price_max,sort,page,limit`, `/products/:id`, `/cart`, `/checkout`, `/orders`, `/orders/:id`, `/profile/addresses`, `/profile/favorites`, `/profile/notifications`, `/wallet`.
- [ ] Admin: `/admin/login` (same `/auth/login` but check role), `/admin/products`, `/admin/orders`, `/admin/deliveries`, `/admin/statistics`, `/admin/members`, `/admin/store`, `/admin/account`, `/admin/preferences`, `/admin/audit`, `/admin/payments` with `role admin` guard.
- [ ] Pagination: all lists with `?page&limit`, UI reading `res.data.data`, `res.data.page`, `res.data.total`, `res.data.totalPages`, disabling next when `page===totalPages`. English-only, no fallback.
- [ ] Errors: toast with `error.code` + inline `details[].field` in forms; 401 → refresh or login; 403 → 403 page; 429 → retry hint with `X-RateLimit-Reset`.
- [ ] Receipt: file input → external upload (Cloudinary/S3) → `POST /orders/:id/payment/receipt {receiptUrl}` (no FormData). Validate `IsUrl` before.
- [ ] Checkout: validate `scheduledDate` >= today, `timeWindow` required, `type` radio `HOME_DELIVERY`/`STORE_PICKUP`, calculate `deliveryFee` via `GET /delivery-zones` or `AdminPreferences` (show 0 for pickup).
- [ ] Address: CRUD with `label`, `province`, `municipality`, `neighborhood`, `street`, `reference`, `isDefault`; handle `ADDRESS_IN_USE` on delete.
- [ ] Cart: use `productId`/`quantity`, handle `INSUFFICIENT_STOCK` with `available`.
- [ ] Tests: new registration, login, add to cart > stock → 400 `INSUFFICIENT_STOCK`, checkout empty cart → 400 `CART_EMPTY`, checkout OK → order `AWAITING_PAYMENT` → init payment `BANK_TRANSFER` → receipt URL → polling until `PAID` (simulate webhook or admin validate).
- [ ] Seed admin: `admin@sadivacloset.local` / `Admin@123` must log in and access `/admin/*`.
- [ ] Swagger imported: `GET https://api-sadivacloset.himersus.com/api/docs-json` (or local) used to generate types; types `Product`, `OrderDetail`, `Payment`, `Address` typed English-only.

---

## 21. Final Notes & Validation

- **Single source of truth:** `GET https://api-sadivacloset.himersus.com/api/docs-json` (local `http://localhost:3001/api/docs-json`) — if it diverges from `SADIVACLOSET.md`, `docs-json` + `docs/API_CONTRACT.md` prevail, but this file was generated scanning **all** `src/**` and `prisma/schema.prisma` on 2026-08-31 and updated to English-only.
- **No backend uploads:** any old mention of `POST /orders/:id/payment/receipt multipart file` or `GET /uploads/<file>` is **obsolete** — frontend sends only URL via `receiptUrl` JSON.
- **English-only contract:** pagination is `{ data, page, total, totalPages }`, errors `{ error: { code, message, details: [{ field, errors }] } }`, DTOs use `label`/`province`/`neighborhood`/`isDefault`/`productId`/`quantity`/`type`/`scheduledDate`/`timeWindow`/`addressId`/`deliveryZoneId`/`method`/`externalReference`/`receiptUrl`/`buyerId`/`deliveryFee`/`createdAt`. No PT keys. Deprecated PT aliases are hidden and must not be used.
- **Validate with:** `pnpm run build && pnpm run test` in backend; `curl https://api-sadivacloset.himersus.com/health` (or `http://localhost:3001/health`) must return `ok`.
- **Questions:** read `src/main.ts` (Swagger description), `src/common/dto/pagination.dto.ts`, `src/modules/*/dto/*.dto.ts` and `prisma/schema.prisma` — all documented above in English.

> Generate SDK: `npx openapi-generator-cli generate -i https://api-sadivacloset.himersus.com/api/docs-json -g typescript-axios -o ./frontend-sdk`
> Local: `npx openapi-generator-cli generate -i http://localhost:3001/api/docs-json -g typescript-axios -o ./frontend-sdk`
> Then: point `SADIVACLOSET.md` to the AI and ask “implement the complete frontend” — it has everything.
