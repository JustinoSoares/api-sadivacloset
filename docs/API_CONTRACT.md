# SadivaCloset API – Frontend Contract (v0.1.0)

**Base URL (Staging – primary):** `https://api-sadivacloset.himersus.com/api/v1` (global prefix)
**Base URL (Local – alternative):** `http://localhost:3001/api/v1`
**Swagger UI (Staging):** `https://api-sadivacloset.himersus.com/api/docs` (no prefix)
**Swagger UI (Local):** `http://localhost:3001/api/docs` (no prefix)
**OpenAPI JSON (Staging):** `https://api-sadivacloset.himersus.com/api/docs-json`
**OpenAPI JSON (Local):** `http://localhost:3001/api/docs-json`
**Health (no prefix, public):** `GET https://api-sadivacloset.himersus.com/health` / `GET http://localhost:3001/health`
**Version:** 0.1.0 | **Code language:** English (tables, classes, endpoints) | **User messages:** English (`{ message: string }`) | **Pagination:** `{ data, page, total, totalPages }` | **Errors:** `{ message: string }` (predictable, no nesting)

> **Deprecated PT aliases:** The codebase keeps Portuguese route aliases (`/produtos`, `/carrinho`, `/pedidos`, `/perfil/*`, `/admin/produtos`…) for backward compatibility but they are **hidden from documentation** (`@ApiExcludeController`/`@ApiExcludeEndpoint`) and **deprecated**. **Frontend MUST use English routes only** as the definitive contract. Swagger shows English routes only. Backend still accepts PT aliases if called, but they must not be used in new code. All responses are **English-only** — no `dados`/`pagina`/`total_paginas` or `erro`/`codigo`/`mensagem` fields.

> **Field aliases (DTOs):** Swagger shows **only English fields** because every Portuguese alias (`nome`, `telefone`, `metodo`, `tipo`, `data_agendada`, `janela_horario`, `produto_id`, `categoria`, `tamanho`, `estado`, `preco_min`, `comprovativo_url`, `receipt_url`, `ordenar`, etc.) is decorated with `@ApiHideProperty()` and therefore hidden from OpenAPI/Swagger. Backend still accepts PT aliases via `class-transformer @Transform` helpers for backward compatibility (e.g., `nome → name`, `telefone → phoneNumber`, `metodo → method`, `tipo → type`, `data_agendada → scheduledDate`, `janela_horario → timeWindow`, `produto_id → productId`, `categoria → category`, `tamanho → size`, `estado → condition`, `preco_min → price_min`, `ordenar → sort`, `comprovativo_url → receiptUrl`). **Frontend MUST send English fields only**; PT examples must never appear in documentation or new client code. All DTO examples below are English-only.

---

## Summary
- [Authentication](#authentication)
- [Headers](#headers)
- [Pagination](#pagination)
- [Errors](#errors)
- [Rate Limiting](#rate-limiting)
- [Receipts](#receipts)
- [Webhooks](#webhooks)
- [Endpoints](#endpoints)
  - [auth](#auth)
  - [products](#products)
  - [categories / delivery-zones](#categories--delivery-zones)
  - [cart](#cart)
  - [checkout](#checkout)
  - [orders / profile/orders](#orders--profileorders)
  - [profile/addresses](#profileaddresses)
  - [payments / wallet](#payments--wallet)
  - [webhooks](#webhooks-1)
  - [favorites / notifications](#favorites--notifications)
  - [admin/*](#admin)
  - [health](#health)
- [Critical Flow Examples](#critical-flow-examples)
- [Error Codes](#error-codes)

---

## Authentication

**Type:** `JWT Bearer`

```
Authorization: Bearer <access_token>
```

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | Public | Register BUYER |
| `/auth/login` | POST | Public | Login → `{ access_token, refresh_token }` |
| `/auth/refresh` | POST | Public | Refresh access_token (rotating + Redis blacklist) |
| `/auth/logout` | POST | Public | Revoke refresh_token (blacklist) |
| `/auth/forgot-password` | POST | Public | Request reset token (15min, Redis) |
| `/auth/reset-password` | POST | Public | Reset password with token |
| `/profile` | GET / PATCH | JWT | Current user profile |

**Register – Request (English-only — do not use `nome`)**
```json
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "password": "StrongPass123"
}
```
**Register – Response `201`**
```json
{
  "data": { "id": "uuid", "name": "Maria Silva", "email": "maria@example.com", "role": "BUYER", "createdAt": "2026-01-03T00:00:00.000Z" }
}
```

**Login – Request (English-only)**
```json
{ "email": "maria@example.com", "password": "StrongPass123" }
```
**Login – Response `200`**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

**Refresh – Request**
```json
{ "refresh_token": "eyJ..." }
```
**Forgot – Request** `POST /auth/forgot-password`
```json
{ "email": "maria@example.com" }
```
Always returns `200 { message: "If the email exists, a reset link has been sent." }` to avoid enumeration. In dev, logs `http://localhost:3001/reset-password?token=<raw>` to console. Token is `randomBytes 32 hex`, stored as `sha256` in `Redis reset:password:<hash> EX 900s`.

**Reset – Request**
```json
{ "token": "hex-64", "newPassword": "StrongPass123" }
```

**Profile – Response `200`**
```json
{
  "data": { "id": "uuid", "name": "Maria Silva", "email": "maria@example.com", "role": "BUYER", "createdAt": "...", "isActive": true }
}
```

**Update profile – Request (English-only)**
```json
{
  "name": "Maria Silva",
  "email": "maria@example.com"
}
```

> Deprecated aliases (hidden, do not use): `POST /auth/registar`, `POST /auth/esqueci-password`, `POST /auth/redefinir-password`, `GET /perfil`, `PATCH /perfil` — still accepted by backend for backward compat but hidden via `@ApiExcludeEndpoint`. Field alias `nome` is hidden via `@ApiHideProperty()` — use `name`.

---

## Headers

**Authenticated:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
x-request-id: <uuid> (optional, generated if missing)
```

**Webhooks (public, HMAC – frontend never calls):**
```
x-signature: <hex HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET)>
Content-Type: application/json
```

**Security (helmet):** `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. `X-Powered-By` removed.

---

## Pagination

**Query:** `?page=1&limit=20` (`PaginationDto` – `page` min 1, `limit` 1-100, default 20, `skip = (page-1)*limit`)

**English-only response:**
```json
{
  "data": [{ "id": "1", "name": "Black Suit" }],
  "page": 1,
  "total": 25,
  "totalPages": 2
}
```

All list endpoints use this shape: `/products`, `/profile/orders`, `/admin/products`, `/admin/orders`, `/admin/deliveries`, `/admin/members`, `/admin/audit`, `/payments/history`, `/wallet/history`.

Legacy `meta: { page, limit, total, totalPages }` is deprecated – use the shape above.

**Frontend helper:**
```ts
const list = res.data.data;
const page = res.data.page;
const totalPages = res.data.totalPages;
const total = res.data.total;
```

---

## Errors

**Single predictable English format — always `{ message: string }`:**
```json
{ "message": "Validation failed: email: must be a valid email" }
```
```json
{ "message": "Insufficient stock" }
```

| Status | Example `message` | When |
|--------|----------|------|
| 400 | `Validation failed: email: must be valid` | Invalid body, extra fields (`whitelist` + `forbidNonWhitelisted`), stock errors |
| 400 | `Insufficient stock` | Not enough stock (`POST /cart/items`, `POST /checkout`) |
| 400 | `Cart is empty` | `POST /checkout` with empty cart |
| 400 | `Invalid payment method` | `POST /orders/:id/payment/init` unknown method |
| 400 | `Address in use` | `DELETE /profile/addresses/:id` with pending orders |
| 400 | `Order already cancelled` / `Delivery in progress` | Cancel/update delivery when in transit |
| 401 | `Token not provided` / `Invalid token` / `Token expired` | Missing/invalid/expired token, inactive account |
| 403 | `Access denied` | `BUYER` tries `/admin/*` (`RolesGuard`) |
| 404 | `Resource not found` | Resource does not exist or does not belong to buyer (IDOR → 404, not 403) |
| 409 | `Email already exists` | Duplicate email (`POST /auth/register`, `PATCH /profile`) |
| 429 | `Too many requests. Please try again later.` | Rate limit exceeded |
| 500 | `An unexpected error occurred.` | Unexpected error (no stack in prod) |

**Validation:** `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` – extra fields → `400 "Validation failed: property: ..."`.

Display `response.data.message` directly to the user (English). Use **HTTP status** for logic (400 validation, 401 refresh/login, 403 forbidden, 404 not found, 409 conflict, 429 rate limit).

---

## Rate Limiting (Redis)

**Only affects `/auth/*` and `/checkout` (`skipIf` elsewhere):**

| Throttler | Limit | TTL | Routes |
|-----------|-------|-----|--------|
| `auth` | 20 | 60s | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/reset-password` |
| `forgot` | 5 | 15min | `POST /auth/forgot-password` |
| `checkout` | 10 | 60s | `POST /checkout` |
| `default` | 60 | 60s | fallback (disabled outside above via `skipIf`) |

Response `429`:
```json
{ "message": "Too many requests. Please try again later." }
```
Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

`GET /products`, `GET /health`, `GET /profile`, `GET /cart` are **not** rate-limited.

---

## Receipts

- **Payment receipt:** `POST /orders/:id/payment/receipt` (`application/json`, field `receiptUrl` – English-only, auth `BUYER` owner of order) → `{ data: Payment }`
- **Flow:** Frontend uploads the image to external storage (e.g., S3, Cloudinary, Vercel Blob) and sends **only the URL** as JSON to the backend. Backend **does not** accept `multipart/form-data` and does not store files. Portuguese aliases `comprovativo_url` / `receipt_url` are hidden via `@ApiHideProperty()` but still accepted via `Transform` for compat – use `receiptUrl` only. Sending `file` → `400 VALIDATION_ERROR`.
- Example:
```json
{ "receiptUrl": "https://res.cloudinary.com/demo/image/upload/receipt.jpg" }
```
Backend sets `payment.receiptUrl = receiptUrl` and `status = PROCESSING` (awaiting admin validation or webhook).

---

## Webhooks

**Public, no JWT, protected by HMAC. Idempotent by `externalReference` (English-only).**

| Route (canonical EN – PT alias hidden/deprecated) | Method | Auth | HMAC Header |
|--------------------------------------------------|--------|------|-------------|
| `POST /webhooks/payment/generic` **(canonical Honor proxy target)** + `POST /webhooks/payment/:gateway` (alias `POST /webhooks/pagamento/:gateway` hidden) | POST | `Public` | `x-signature` |
| `POST /webhooks/bridpay` (alias `POST /webhooks/pagamentos/bridpay` hidden) | POST | `Public` | `x-signature` |
| `POST /webhooks/appypay` | POST | `Public` | `x-signature` |
| `POST /webhooks/ekwanza` | POST | `Public` | `x-signature` |

**Gateway `param`:** `appypay|ekwanza|generic|bridpay|gpo|gpr|kwik`

**Env (Sadiva):** `PAYMENT_WEBHOOK_SECRET` (generic) or `PAYMENT_WEBHOOK_SECRET_<GATEWAY>` (e.g., `PAYMENT_WEBHOOK_SECRET_APPYPAY`). If not set, HMAC check is skipped in dev with `logger.warn`.

**Generate signature (Node):**
```js
const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
// header: 'x-signature: ' + sig  // or 'sha256=' + sig, both accepted
// alternative: use rawBody string exactly as sent – both are tried
```

**Generic payload (English-only):**
```json
{
  "externalReference": "merchant-tx-id-15chars",
  "status": "paid",
  "amount": 50000
}
```
`status` accepts `paid|settled|success|confirmed|approved` → marks `Payment.status=PAID`, `Order.status=PAID`, creates `WalletTransaction settled`, notifies buyer, enqueues `BullMQ payment-confirmed`. `failed|rejected|cancelled` → `FAILED`. Missing `externalReference` → `400 MISSING_REFERENCE`. Missing `x-signature` when secret configured → `400 MISSING_SIGNATURE`, invalid → `400 INVALID_SIGNATURE`.

**E-Kwanza specific webhook:** payload `{ code, operationCode, status }`, HMAC = `HMAC_SHA256(code+operationCode+registrationNumber+token, apiKey)` via `EKWANZA_API_KEY`. BridPay: `{ merchantTxId, providerTxId, status }`.

**Idempotency:** `externalReference` is the key – `Redis SET webhook:payment:${gateway}:${ref} EX 7d` + column `webhookProcessedAt`. Second call with same ref → `200 { ok: true, idempotent: true, message: "Already processed" }` without reprocessing.

**Frontend:** Never call webhooks. Poll `GET /orders/:id` or `GET /orders/:id/payment` until `PAID`.

**Multi-app proxy (Honor ↔ Sadiva):** When the payment gateway can only call **one** webhook URL (Honor), Honor acts as router/multiplexer on its existing `POST /webhooks/payment/:gateway` route and proxies Sadiva payments. **Sadiva requires no code change** – its routes above remain the single source of truth. Honor identifies the target app per request and either handles it locally (`app=honor`) or proxies to Sadiva (`app=sadiva`).

Honor identification order: `x-app|x-source` header → `payload shape` (`merchantTransactionId+operationStatus`=AppyPay/Sadiva, `code+operationCode`=E-Kwanza/Sadiva) → `gateway` param → `DB lookup by externalReference` → `HMAC trial` (`HONOR_SECRET` vs `SADIVA_SECRET`). Honor uses namespaced idempotency keys `webhook:honor:${gateway}:${ref}` vs `webhook:sadiva:${gateway}:${ref}`.

Honor env (Honor has no webhook secret today – create from scratch):

```env
PAYMENT_WEBHOOK_SECRET_HONOR="openssl-rand-hex-32-honor-32chars"
PAYMENT_WEBHOOK_SECRET_SADIVA="copie-exatamente-o-PAYMENT_WEBHOOK_SECRET-da-Sadiva-prod"
SADIVA_WEBHOOK_URL="https://api-sadivacloset.himersus.com/api/v1/webhooks/payment/generic"
# optional per-gateway:
PAYMENT_WEBHOOK_SECRET_APPYPAY="mesmo-APPYPAY_WEBHOOK_SECRET-da-Sadiva"
PAYMENT_WEBHOOK_SECRET_EKWANZA="mesmo-EKWANZA_API_KEY-da-Sadiva"
```

`PAYMENT_WEBHOOK_SECRET_SADIVA` must be **identical** to Sadiva's `PAYMENT_WEBHOOK_SECRET`; Honor re-signs the forwarded `rawBody` with it (`x-signature: HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET_SADIVA)`) or forwards the original signature if already signed with Sadiva's secret. `rawBody` capture (`express.json verify: req.rawBody=buf`) is required on Honor for `timingSafeEqual` validation.

---

## Realtime — WebSocket (Socket.IO)

**Namespace:** `/realtime` | **Transports:** `websocket, polling` | **Auth:** JWT `Bearer` | **Ver contrato completo em [`docs/WEBSOCKET.md`](./WEBSOCKET.md)** (única fonte para integrar).

**URLs:** `wss://api-sadivacloset.himersus.com/realtime` (staging) | `ws://localhost:3001/realtime` (Docker) | `ws://localhost:3002/realtime` (host).

**Conexão:**
```ts
import { io } from "socket.io-client";
const socket = io("https://api-sadivacloset.himersus.com/realtime", {
  transports: ["websocket","polling"],
  auth: { token: `Bearer ${accessToken}` } // ou extraHeaders Authorization ou query token
});
socket.on("connected", console.log); // { userId } ou anon
socket.on("joined", console.log);    // { rooms:["buyer:uuid"] }
socket.emit("auth:join", { token:`Bearer ${accessToken}` }); // se conectou anon
```

**Rooms:** `buyer:${userId}` (auto join) + `admins` (se `role=ADMIN`).

**Eventos servidor → cliente:**
| Evento | Quando | Payload |
|--------|--------|---------|
| `payment:confirmed` + `payment:paid` (alias) | `POST /webhooks/*` `paid`, `PATCH /admin/payments/:id/validar` | `{ orderId, paymentId, amount, gateway, externalReference, confirmedAt }` |
| `payment:failed` | `operationStatus 3/4/5` | `{ orderId, paymentId, gateway, failedAt }` |
| `notification:new` | `NotificationsService.criar` (qualquer notificação) | `{ notification: { id, buyerId, title, description, isRead, createdAt } }` |
| `order:statusUpdated` | `PATCH /admin/orders/:id/status` | `{ orderId, status, previousStatus, updatedBy }` |
| `delivery:statusUpdated` | `PATCH /admin/deliveries/:id/status` | `{ deliveryId, orderId, status, previousStatus }` |
| `admin:newOrder` | `POST /checkout` | `{ orderId, buyerId, total }` — só `admins` |
| `connected`/`joined`/`error` | handshake | `{ userId, message }` |

Use `socket.on("payment:confirmed", ...)` + fallback polling `GET /orders/:id/payment` a cada 3s por 2min. Ver `docs/WEBSOCKET.md` para hook React `useRealtime`, Vue, vanilla + notificações + admin.

---

## Endpoints

### auth
| Method | Route | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| POST | `/auth/register` | Public | `{name,email,password}` | `201 {data}` |
| POST | `/auth/login` | Public | `{email,password}` | `200 {access_token,refresh_token}` |
| POST | `/auth/refresh` | Public | `{refresh_token}` | `200 {access_token,refresh_token}` |
| POST | `/auth/logout` | Public | `{refresh_token}` | `200 {message}` |
| POST | `/auth/forgot-password` | Public (forgot 5/15min) | `{email}` | `200 {message}` |
| POST | `/auth/reset-password` | Public | `{token,newPassword}` | `200 {message}` |
| GET | `/profile` | JWT | - | `200 {data}` |
| PATCH | `/profile` | JWT | `{name?,email?}` | `200 {data}` |

Deprecated PT aliases (`POST /auth/registar`, `POST /auth/esqueci-password`, `POST /auth/redefinir-password`, `GET /perfil`, `PATCH /perfil`) are hidden – do not use. Field `nome` hidden via `@ApiHideProperty()` — use `name`.

### products
| Method | Route | Auth | Query/Body | Response |
|--------|------|------|------------|----------|
| GET | `/products` | Public | `?q=&category=SUITS,SHIRTS&size=M&condition=NEW&price_min=&price_max=&sort=recent|price_asc|price_desc|name_asc|oldest&page=&limit=` | `200 { data: Product[], page, total, totalPages }` |
| GET | `/products/:id` | Public | `param id UUID` | `200 {data: Product}` |

`FilterProductsDto` query params (English-only; PT aliases `categoria→category`, `tamanho→size`, `estado→condition`, `preco_min→price_min`, `ordenar→sort` are hidden via `@ApiHideProperty()` but still accepted for backward compat via `Transform` — frontend MUST use English):
- `q` – search `name` OR `description` `contains insensitive`
- `category` – CSV `SUITS,SHIRTS,DRESSES,OTHERS`
- `size` – CSV `M,L` etc
- `condition` – CSV `NEW,PRE_OWNED`
- `price_min` / `price_max` – int, filters by `discountedPrice = round(price - price*discount/100)`
- `sort` – `recent` (default), `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`
- `page`, `limit` – pagination

Cache `60s` `cache:products:*` (Redis). Invalidated on `POST/PATCH/DELETE /admin/products`.

**Product DTO**
```json
{
  "id": "uuid",
  "image": "https://cdn.com/a.jpg",
  "name": "Black Suit",
  "description": "...",
  "category": "SUITS",
  "size": "M",
  "condition": "NEW",
  "stock": 10,
  "price": 45000,
  "discount": 10,
  "createdAt": "2026-01-03T00:00:00.000Z"
}
```

### categories / delivery-zones
| Method | Route | Auth | Response |
|--------|------|------|----------|
| GET | `/categories` | Public | `200 {data: [{ category, total }]}` |
| GET | `/delivery-zones` | Public | `200 {data: [{id,neighborhood,price}]}` |

Both cached 60s. Categories returns all 4 categories via `Object.values(Category)` + `groupBy` even if `total:0`.

Deprecated PT `GET /categorias`, `GET /zonas-entrega` hidden.

### cart
| Method | Route | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/cart` | JWT (BUYER) | - | `200 { data: { items, subtotal, totalItems, totalQuantity } }` |
| POST | `/cart/items` | JWT | `{productId, quantity}` | `201 {data: CartItem}` |
| PATCH | `/cart/items/:id` | JWT | `{quantity}` | `200 {data}` |
| DELETE | `/cart/items/:id` | JWT | - | `200 {message}` |

English-only DTOs. `productId` must be UUID, `quantity >=1`. Validates stock → `400 INSUFFICIENT_STOCK` with `details` `{ available, requested }`. `:id` is `CartItem.id` (not `productId`). Add is upsert (existing quantity summed). `GET /cart` enriches each item with `product`, `discountedPrice`, `subtotal`.

**AddCartItemDto (English-only — do not use `produto_id`)**
```json
{ "productId": "uuid", "quantity": 2 }
```

**Get Cart Response**
```json
{
  "data": {
    "items": [{ "id":"cartItemId","productId":"prodId","quantity":2,
                "product": { "id":"...","name":"...", "price":45000, "discount":10 },
                "discountedPrice":40500, "subtotal":81000 }],
    "subtotal": 81000,
    "totalItems": 1,
    "totalQuantity": 2
  }
}
```

Deprecated PT `POST /carrinho/itens` etc hidden. Field `produto_id` hidden via `@ApiHideProperty()` — use `productId`.

### checkout
| Method | Route | Auth | Body | Response | Throttle |
|--------|------|------|------|----------|----------|
| POST | `/checkout` | JWT | `{type,scheduledDate,timeWindow,addressId?,deliveryZoneId?}` | `201 {data: Order}` | checkout 10/min |

**CheckoutDto (English-only — do not use `tipo`/`data_agendada`/`janela_horario`)**
```json
{
  "type": "HOME_DELIVERY",
  "scheduledDate": "2026-09-01",
  "timeWindow": "09:00-12:00",
  "addressId": "uuid",
  "deliveryZoneId": "uuid"
}
```
- `type`: `HOME_DELIVERY` (delivery) or `STORE_PICKUP` (pickup). Legacy `domicilio`/`levantamento_loja` and PT fields `tipo`/`data_agendada`/`janela_horario` are hidden via `@ApiHideProperty()` but still accepted via `Transform` for compat – frontend must send English `type`/`scheduledDate`/`timeWindow`.
- `scheduledDate`: ISO `YYYY-MM-DD`, must be `>= today 00:00 UTC` else `400 INVALID_REQUEST`.
- `timeWindow`: `09:00-12:00` etc, required.
- `addressId` / `deliveryZoneId`: optional, resolve `deliveryFee`:
  - `STORE_PICKUP`: `fee=0`
  - `HOME_DELIVERY` + `addressId`: validate owner → `404`; if `deliveryZoneId` → `fee=zone.price` else lookup `DeliveryZone` by `address.neighborhood` else `AdminPreferences.defaultDeliveryFee` (fallback 2500/3000)
  - Only `deliveryZoneId`: `fee=zone.price`
  - None: try default address then prefs.

Transaction: validates cart not empty, validates stock per item, decrements `product.stock` atomically, creates `order` (`AWAITING_PAYMENT`) + `orderItems` + `delivery` (`SCHEDULED`), empties `cart_items`. Errors: `CART_EMPTY`, `INSUFFICIENT_STOCK`, `VALIDATION_ERROR`.

### orders / profile/orders
| Method | Route | Auth | Response |
|--------|------|------|----------|
| GET | `/orders/:id` | JWT (owner) | `200 {data: OrderDetail}` |
| PATCH | `/orders/:id/cancel` | JWT (owner) | `200 {data}` (restores stock, cancels delivery) |
| POST | `/orders/:id/delivery` | JWT (owner) | `200 {data}` (create/update delivery) |
| GET | `/profile/orders` | JWT | `200 { data, page, total, totalPages }` |

Ownership: `order.buyerId !== user.sub` → `404 NOT_FOUND` (not 403, to avoid enumeration).

Deprecated PT `GET /pedidos/:id`, `PATCH /pedidos/:id/cancelar`, `POST /pedidos/:id/entrega`, `GET /perfil/pedidos` hidden.

**OrderDetail (English-only)**
```json
{
  "id": "uuid",
  "buyerId": "uuid",
  "subtotal": 90000,
  "deliveryFee": 2500,
  "total": 92500,
  "status": "AWAITING_PAYMENT",
  "createdAt": "2026-01-03T00:00:00.000Z",
  "items": [{ "productId": "uuid", "productName": "...", "unitPrice": 45000, "discount": 10, "quantity": 2 }],
  "delivery": { "type": "HOME_DELIVERY", "addressId": "uuid", "scheduledDate": "2026-09-01", "timeWindow": "09:00-12:00", "status": "SCHEDULED", "deliveryFee": 2500 },
  "payment": { "method": "BANK_TRANSFER", "amount": 92500, "status": "PENDING", "externalReference": "15chars", "receiptUrl": null }
}
```
Enums: `OrderStatus: AWAITING_PAYMENT|PAID|PREPARING|SHIPPING|COMPLETED|CANCELLED`, `DeliveryStatus: SCHEDULED|ON_THE_WAY|DELIVERED|FAILED|CANCELLED`.

**Cancel rules:** already `CANCELLED` → `400 ORDER_ALREADY_CANCELLED`; `COMPLETED` → `ORDER_NOT_CANCELLABLE`; `delivery ON_THE_WAY/DELIVERED` or `order SHIPPING` → `DELIVERY_IN_PROGRESS`.

**Upsert Delivery `POST /orders/:id/delivery` body (English-only)**
```json
{ "addressId": "uuid", "scheduledDate": "2026-09-12", "timeWindow": "09:00-12:00", "instructions": "Leave at door" }
```
Requires `scheduledDate && timeWindow` if no existing delivery. Blocks if `ON_THE_WAY`/`DELIVERED`.

### profile/addresses
| Method | Route | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/profile/addresses` | JWT | - | `200 {data: Address[]}` |
| POST | `/profile/addresses` | JWT | `{label,province,municipality,neighborhood,street,reference?,latitude?,longitude?}` | `201 {data}` |
| PATCH | `/profile/addresses/:id` | JWT (owner) | `{label?,province?,...}` | `200 {data}` |
| DELETE | `/profile/addresses/:id` | JWT (owner) | - | `200 {message}` |
| PATCH | `/profile/addresses/:id/default` | JWT (owner) | - | `200 {data}` |

Deprecated PT `perfil/enderecos` hidden.

**Create Address – Request (English-only)**
```json
{
  "label": "Home",
  "province": "Luanda",
  "municipality": "Talatona",
  "neighborhood": "Benfica",
  "street": "123 Main St"
}
```

**Address DTO (English-only)**
```json
{
  "id": "uuid",
  "buyerId": "uuid",
  "label": "Home",
  "province": "Luanda",
  "municipality": "Talatona",
  "neighborhood": "Benfica",
  "street": "123 Main St",
  "reference": "Near shop",
  "latitude": -8.9,
  "longitude": 13.2,
  "isDefault": true
}
```
Rules: first address auto `isDefault=true`. Delete blocked if single address with pending orders → `400 ADDRESS_IN_USE`. `setDefault` transaction clears previous.

### payments / wallet
| Method | Route | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| POST | `/orders/:id/payment/init` | JWT (owner) | `{method,phoneNumber?,iban?,description?}` | `201 {data: Payment}` |
| GET | `/orders/:id/payment` | JWT (owner) | - | `200 {data: Payment}` |
| POST | `/orders/:id/payment/receipt` | JWT (owner) | `JSON { receiptUrl }` | `200 {data: Payment}` |
| GET | `/payments/history` | JWT | `?page&limit&type=credit|debit` | `200 { data, page, total, totalPages }` |
| GET | `/wallet/history` | JWT | `?page&limit` | `200 { data, page, total, totalPages }` |

Deprecated PT `POST /pedidos/:id/pagamento/iniciar`, `GET /pagamentos/historico`, history aliases `/payments/entries`, `/payments/exits`, `/payments/wallet/history` hidden – use English. Fields `metodo`/`telefone` hidden via `@ApiHideProperty()` — use `method`/`phoneNumber`.

> **GPO vs GPR — USE THIS TABLE (Swagger now shows examples):**
> | Goal | Route (JWT BUYER) | `method` value (EN) | Required fields | Example body |
> |------|-------------------|---------------------|-----------------|--------------|
> | **GPO – Multicaixa Express** | `POST /orders/:id/payment/init` | `gpo` or `MULTICAIXA_EXPRESS` or `multicaixa_express` | `phoneNumber: "923456789"` (AO, 9 digits) + optional `description` | `{"method":"gpo","phoneNumber":"923456789"}` |
> | **GPR – Referência** | `POST /orders/:id/payment/init` | `gpr` or `MULTICAIXA_REFERENCE` or `multicaixa_reference` or `reference` | optional `description` (no phone) | `{"method":"gpr"}` |
> After init: GPO/GPR → `Payment.status=PROCESSING`, `externalReference=15chars`, `providerDetails={provider:"appypay", entity, reference, expirationDate}` (GPR: show entity/reference to buyer). Poll `GET /orders/:id/payment` or `GET /orders/:id` until webhook `POST /webhooks/appypay` or `POST /webhooks/payment/generic` sets `PAID`.

`method` accepts: `multicaixa_express|gpo → MULTICAIXA_EXPRESS`, `multicaixa_reference|gpr|reference → MULTICAIXA_REFERENCE`, `bank_transfer → BANK_TRANSFER`, `cash_on_delivery → CASH_ON_DELIVERY`, `card → CARD`, `kwik → BANK_TRANSFER` (E-Kwanza). Invalid → `400 INVALID_METHOD`. GPO without `phoneNumber` → `400 VALIDATION_ERROR phoneNumber required for GPO`.

**Payment Init – Requests (English-only — do not use `metodo`/`telefone`)**

GPO:
```json
{ "method": "gpo", "phoneNumber": "923456789", "description": "Pedido abc123 - GPO" }
```
GPR:
```json
{ "method": "gpr", "description": "Pedido abc123 - GPR" }
```
Also accepted full EN: `{"method":"MULTICAIXA_EXPRESS","phoneNumber":"923456789"}` and `{"method":"MULTICAIXA_REFERENCE"}`. Do NOT send `{"metodo":"gpo","telefone":"923..."}` (hidden).

Bank transfer example:
```json
{ "method": "BANK_TRANSFER", "description": "Order payment" }
```

**Payment Response (English-only)**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "method": "BANK_TRANSFER",
  "amount": 92500,
  "status": "PENDING",
  "externalReference": "15chars",
  "receiptUrl": null,
  "phoneNumber": null,
  "iban": null,
  "createdAt": "2026-01-03T00:00:00.000Z",
  "updatedAt": "2026-01-03T00:00:00.000Z"
}
```
`status: PENDING|PROCESSING|PAID|FAILED|REFUNDED`, `method: MULTICAIXA_EXPRESS|MULTICAIXA_REFERENCE|BANK_TRANSFER|CASH_ON_DELIVERY|CARD`.

**Payment Receipt – Request (English-only)**
```json
{ "receiptUrl": "https://res.cloudinary.com/demo/image/upload/receipt.jpg" }
```

### webhooks
| Method | Route | Auth | Headers | Body | Response |
|--------|------|------|---------|------|----------|
| POST | `/webhooks/payment/:gateway` | Public | `x-signature` | `{externalReference,status,amount?}` | `200 {ok:true,status:"paid",idempotent?}` |
| POST | `/webhooks/bridpay` | Public | `x-signature` | `{merchantTxId,providerTxId,status}` | `200 {ok}` |
| POST | `/webhooks/appypay` | Public | `x-signature` | `{merchantTransactionId,operationStatus}` | `200` |
| POST | `/webhooks/ekwanza` | Public | `x-signature` | `{code,operationCode,status}` | `200` |

See [Webhooks](#webhooks) section for HMAC and idempotency details.

### favorites / notifications
| Method | Route | Auth | Response |
|--------|------|------|----------|
| GET | `/profile/favorites` | JWT | `200 {data: Product[]}` |
| POST | `/profile/favorites/:productId` | JWT | `201 {data: Product}` (idempotent) |
| DELETE | `/profile/favorites/:productId` | JWT | `200 {message}` (idempotent) |
| GET | `/profile/notifications` | JWT | `200 {data: Notification[]}` |
| PATCH | `/profile/notifications/read` | JWT | `200 {data:{count}, message}` |
| PATCH | `/profile/notifications/:id/read` | JWT | `200 {data: Notification}` |

Deprecated PT `favoritos`, `notificacoes` hidden.

**Notification DTO (English-only)**
```json
{ "id":"uuid","buyerId":"uuid","title":"Payment confirmed","description":"Order #... paid","createdAt":"...","isRead":false }
```

### admin/*
All require `Authorization: Bearer <adminToken>` + `role=admin` (via `@Roles('admin')` + fallback `isAdminPath`). No token → `401 UNAUTHENTICATED`, `BUYER` → `403 FORBIDDEN`.

| Method | Route | Description |
|--------|------|-------------|
| GET | `/admin/products` | Paginated products (filters `?q&category&page&limit`) |
| POST | `/admin/products` | Create product |
| PATCH | `/admin/products/:id` | Update (invalidates cache, audit) |
| DELETE | `/admin/products/:id` | Remove + invalidate cache |
| GET | `/admin/orders` | List orders `?status&from&to&page&limit` |
| PATCH | `/admin/orders/:id/status` | Update order `status` (`AWAITING_PAYMENT|PAID|...`) |
| GET | `/admin/deliveries` | List deliveries `?status&from&to&page&limit` |
| PATCH | `/admin/deliveries/:id/status` | Update delivery status |
| GET | `/admin/statistics` | Dashboard: `totalRevenue` (sum `total` where `PAID|COMPLETED`), `totalProducts`, `totalMembers`, `totalOrders` + `variation` % vs previous period (`?days=30` or `?from&to`) + `recentOrders` paginated |
| GET | `/admin/store` | `StoreConfig` |
| PATCH | `/admin/store` | Update `name,contactEmail,phone,address` |
| GET | `/admin/account` | Authenticated admin account |
| PATCH | `/admin/account` | Update `name,email` + change `currentPassword/newPassword` |
| GET | `/admin/preferences` | `AdminPreferences` |
| PATCH | `/admin/preferences` | `notifyNewOrders,notifyLowStock,notifyNewMessages,defaultDeliveryFee,activePaymentMethods[]` |
| GET | `/admin/members` | List `BUYER` paginated `?q` (name/email) with `totalOrders` and `totalSpent` via `groupBy buyerId` |
| GET | `/admin/members/:id/orders` | Member order history |
| GET | `/admin/audit` | Logs `?entity&from&to&page&limit` |
| PATCH | `/admin/payments/:id/validate` | Manual validate payment → `Payment PAID` + `Order PAID` |
| GET | `/admin/payments/history` | Filtered payments `?method&status&page&limit` |

Deprecated PT (`/admin/produtos`, `/admin/pedidos`, `/admin/entregas`, `/admin/estatisticas`, `/admin/loja`, `/admin/conta`, `/admin/preferencias`, `/admin/membros`, `/admin/auditoria`, `/admin/pagamentos`) hidden.

**Admin Create Product – Request (English-only)**
```json
{
  "image": "https://cdn.com/a.jpg",
  "name": "Black Suit",
  "description": "Classic suit for formal events",
  "category": "SUITS",
  "size": "M",
  "condition": "NEW",
  "stock": 10,
  "price": 45000
}
```

**Admin Statistics – Response `200` (English-only)**
```json
{
  "totalRevenue": 100000,
  "revenue": { "value": 30000, "previousValue": 20000, "percentage": 50, "grew": true, "totalValue": 100000 },
  "totalProducts": 50,
  "products": { "value": 10, "previousValue": 5, "percentage": 100, "grew": true },
  "totalMembers": 100,
  "totalOrders": 80,
  "period": { "days": 30, "from": "...", "to": "...", "previousFrom": "..." },
  "variation": { "revenue": { "value": 30000, "previousValue": 20000, "percentage": 50 }, "products": { "value": 10, "previousValue": 5, "percentage": 100 } },
  "recentOrders": { "data": [], "page": 1, "total": 80, "totalPages": 4 }
}
```

### health
| Method | Route | Auth | Response |
|--------|------|------|----------|
| GET | `/health` | Public (excluded from prefix) | `200 {status:"ok",database:"up",timestamp}` |
| GET | `/` | Public (excluded) | `200 {name, status}` |

---

## Critical Flow Examples

**1. Register → Login → Create product (admin) → List → Cart → Checkout → Payment → Receipt → Webhook**

```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
# 1. Register (English-only)
curl -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","email":"maria@example.com","password":"StrongPass123"}'

# 2. Login
curl -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@example.com","password":"StrongPass123"}'
# → { access_token, refresh_token }

# 3. Admin creates product (adminToken) — English-only
curl -X POST $BASE/admin/products \
  -H "Authorization: Bearer $adminToken" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://cdn.com/a.jpg","name":"Black Suit","description":"Classic suit for formal events","category":"SUITS","size":"M","condition":"NEW","stock":10,"price":45000}'

# 4. Public list (no auth) — English query filters
curl "$BASE/products?q=Suit&category=SUITS&size=M&condition=NEW&price_min=10000&price_max=50000&sort=recent&page=1&limit=12"

# 5. Cart (validates stock) — English-only
curl -X POST $BASE/cart/items \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"productId":"uuid","quantity":2}'
# insufficient stock → 400 { message: "Insufficient stock" }

# 6. Checkout (HOME_DELIVERY with address) — English-only
curl -X POST $BASE/checkout \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"type":"HOME_DELIVERY","scheduledDate":"2026-09-01","timeWindow":"09:00-12:00","addressId":"uuid","deliveryZoneId":"uuid"}'
# → { data: { id: "order-uuid", total, status: "AWAITING_PAYMENT" } }

# Alternative: STORE_PICKUP (no fee)
curl -X POST $BASE/checkout \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"type":"STORE_PICKUP","scheduledDate":"2026-09-01","timeWindow":"09:00-12:00"}'

# 7. Initiate payment — English-only (do not use metodo/telefone)
curl -X POST $BASE/orders/<orderId>/payment/init \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"method":"BANK_TRANSFER","phoneNumber":"923456789","description":"Order payment"}'
# or GPO: {"method":"MULTICAIXA_EXPRESS","phoneNumber":"923456789"}

# 8. Upload receipt externally, then send URL only — English-only
curl -X POST $BASE/orders/<orderId>/payment/receipt \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"receiptUrl":"https://res.cloudinary.com/demo/image/upload/receipt.jpg"}'

# 9. Webhook (HMAC) – called by gateway, not frontend
PAYLOAD='{"externalReference":"<externalReference>","status":"paid"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | cut -d' ' -f2)
curl -X POST $BASE/webhooks/payment/generic \
  -H "x-signature: $SIG" -H "Content-Type: application/json" \
  -d "$PAYLOAD"
# 2nd call same ref → 200 { ok:true, idempotent:true }

# 10. Verify order paid
curl $BASE/orders/<orderId> -H "Authorization: Bearer $buyerToken"
# → status PAID
```

**Update profile example**
```bash
curl -X PATCH $BASE/profile \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","email":"maria@example.com"}'
```

**Create address example (English-only)**
```bash
curl -X POST $BASE/profile/addresses \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"label":"Home","province":"Luanda","municipality":"Talatona","neighborhood":"Benfica","street":"123 Main St"}'
```

**Update delivery example (English-only)**
```bash
curl -X POST $BASE/orders/<orderId>/delivery \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"addressId":"uuid","scheduledDate":"2026-09-01","timeWindow":"09:00-12:00"}'
```

**2. IDOR – ownership (must return 404, not 403)**
```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
# buyer2 tries to view buyer1's order → 404 (not 403, to avoid enumeration)
curl $BASE/orders/<orderId-buyer1> -H "Authorization: Bearer $buyer2Token"
# → 404 { message: "Order not found" }
```

**3. Admin guard**
```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
curl $BASE/admin/products # no token → 401
curl $BASE/admin/products -H "Authorization: Bearer $buyerToken" # → 403
curl $BASE/admin/products -H "Authorization: Bearer $adminToken" # → 200
```

---

## Error Codes (HTTP status + message)

| Status | Example `message` (EN) | Usage |
|------|--------------|-------|
| 400 | `Validation failed: ...` | DTO failed, `forbidNonWhitelisted` |
| 400 | `Insufficient stock` | `POST /cart/items`, `POST /checkout` |
| 400 | `Cart is empty` | `POST /checkout` |
| 400 | `Invalid payment method` | `POST /orders/:id/payment/init` |
| 400 | `Address in use` | `DELETE /profile/addresses/:id` |
| 400 | `Missing external reference` | Webhook without ref |
| 400 | `Missing signature` / `Invalid signature` | Webhook HMAC |
| 401 | `Token not provided` / `Invalid token` / `Token expired` | `JwtAuthGuard` – missing/invalid/expired token |
| 403 | `Access denied` | `RolesGuard` – BUYER on `/admin/*` |
| 404 | `Resource not found` / `Order not found` | Resource missing or IDOR (ownership) |
| 409 | `Email already exists` | `POST /auth/register`, `PATCH /profile` |
| 429 | `Too many requests. Please try again later.` | Throttler |
| 500 | `An unexpected error occurred.` | `HttpExceptionFilter` (no stack in prod) |

> All errors are `{ message: string }` — frontend reads `response.data.message`. No `error.code`/`details` nesting.

---

## Frontend Notes

- **Always send `Authorization: Bearer <access_token>`** after login; use `refresh_token` to renew via `POST /auth/refresh`. On `401`, try refresh, else redirect to `/login`.
- **Pagination is English-only:** read `res.data`, `res.page`, `res.total`, `res.totalPages`. There is no `dados`/`pagina` fallback.
- **Display `message` directly** (English) — `response.data.message`. Use HTTP status for logic (401 refresh, 403 forbidden, 404 not found, 409 conflict, 429 rate limit).
- **Cache:** `GET /products` has server `Cache 60s` (Redis) – frontend may cache but invalidation is server-side on admin product mutations.
- **Receipts:** send `JSON { "receiptUrl": "https://..." }` to `POST /orders/:id/payment/receipt`. Backend does not accept file uploads. Validate `IsUrl` on frontend before sending; 5MB limit should be enforced at external storage. PT alias `comprovativo_url` hidden via `@ApiHideProperty()` — use `receiptUrl`.
- **Aliases:** Never use PT aliases (`/produtos`, `/carrinho`, etc.) – they are deprecated and hidden from Swagger via `@ApiExcludeController`/`@ApiExcludeEndpoint`. Use English routes exclusively. DTO PT aliases (`nome`→`name`, `telefone`→`phoneNumber`, `metodo`→`method`, `tipo`→`type`, `data_agendada`→`scheduledDate`, `janela_horario`→`timeWindow`, `produto_id`→`productId`, `categoria`→`category`, `tamanho`→`size`, `estado`→`condition`, `preco_min`→`price_min`, `ordenar`→`sort`, `comprovativo_url`→`receiptUrl`) are hidden via `@ApiHideProperty()` but still accepted via `Transform` for backward compat — frontend MUST send English. Swagger shows only English.
- **Webhooks:** are **public** (no JWT) – frontend **never** calls them; only gateways with `x-signature`.
- **Rate limiting:** show `Too many requests` (429) with retry after `X-RateLimit-Reset` header.
- **CORS:** controlled by `CORS_ALLOWED_ORIGINS` env (comma-separated, alias `CORS_ORIGIN`). Dev: empty → allow all. Prod: required explicit list e.g. `https://sadivacloset.co.ao,https://www.sadivacloset.co.ao,https://api-sadivacloset.himersus.com`.
- **Swagger is contract:** `GET https://api-sadivacloset.himersus.com/api/docs-json` (or local `http://localhost:3001/api/docs-json`) can be imported into Postman/Insomnia or used with `openapi-generator` for SDK.

**Base URLs:**
- **Staging (primary):** `https://api-sadivacloset.himersus.com/api/v1` – Swagger `https://api-sadivacloset.himersus.com/api/docs`
- **Local (alternative):** `http://localhost:3001/api/v1` (Docker host) or `http://localhost:3002/api/v1` if `PORT=3002` in `.env` – Swagger `http://localhost:3001/api/docs`

> Generate SDK: `npx openapi-generator-cli generate -i https://api-sadivacloset.himersus.com/api/docs-json -g typescript-axios -o ./frontend-sdk`
> Local alternative: `npx openapi-generator-cli generate -i http://localhost:3001/api/docs-json -g typescript-axios -o ./frontend-sdk`
