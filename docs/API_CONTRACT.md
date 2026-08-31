# SadivaCloset API – Frontend Contract (v0.1.0)

**Base URL (Staging – primary):** `https://api-sadivacloset.himersus.com/api/v1` (global prefix)
**Base URL (Local – alternative):** `http://localhost:3001/api/v1`
**Swagger UI (Staging):** `https://api-sadivacloset.himersus.com/api/docs` (no prefix)
**Swagger UI (Local):** `http://localhost:3001/api/docs` (no prefix)
**OpenAPI JSON (Staging):** `https://api-sadivacloset.himersus.com/api/docs-json`
**OpenAPI JSON (Local):** `http://localhost:3001/api/docs-json`
**Health (no prefix, public):** `GET https://api-sadivacloset.himersus.com/health` / `GET http://localhost:3001/health`
**Version:** 0.1.0 | **Code language:** English (tables, classes, endpoints) | **User messages:** English (`{ error: { code, message } }`) | **Pagination:** `{ data, page, total, totalPages }` | **Errors:** `{ error: { code, message, details: [{ field, errors }] } }`

> **Deprecated PT aliases:** The codebase keeps Portuguese route aliases (`/produtos`, `/carrinho`, `/pedidos`, `/perfil/*`, `/admin/produtos`…) for backward compatibility but they are **hidden from documentation** (`@ApiExcludeController`/`@ApiExcludeEndpoint`) and **deprecated**. **Frontend MUST use English routes only** as the definitive contract. Swagger shows English routes only. Backend still accepts PT aliases if called, but they must not be used in new code. All responses are **English-only** — no `dados`/`pagina`/`total_paginas` or `erro`/`codigo`/`mensagem` fields.

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

**Register – Request**
```json
{
  "name": "Buyer Test",
  "email": "buyer@test.com",
  "password": "BuyerPass123!"
}
```
**Register – Response `201`**
```json
{
  "data": { "id": "uuid", "name": "Buyer Test", "email": "buyer@test.com", "role": "BUYER", "createdAt": "2026-01-03T00:00:00.000Z" }
}
```

**Login – Request**
```json
{ "email": "buyer@test.com", "password": "BuyerPass123!" }
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
{ "email": "buyer@test.com" }
```
Always returns `200 { message: "If the email exists, a reset link has been sent." }` to avoid enumeration. In dev, logs `http://localhost:3001/reset-password?token=<raw>` to console. Token is `randomBytes 32 hex`, stored as `sha256` in `Redis reset:password:<hash> EX 900s`.

**Reset – Request**
```json
{ "token": "hex-64", "newPassword": "NewPass123!" }
```

**Profile – Response `200`**
```json
{
  "data": { "id": "uuid", "name": "...", "email": "...", "role": "BUYER", "createdAt": "...", "isActive": true }
}
```

> Deprecated aliases (hidden, do not use): `POST /auth/registar`, `POST /auth/esqueci-password`, `POST /auth/redefinir-password`, `GET /perfil`, `PATCH /perfil` — still accepted by backend for backward compat.

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

**Single English format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "email", "errors": ["email must be a valid email"] }]
  }
}
```

| Status | `code` | When |
|--------|--------|------|
| 400 | `VALIDATION_ERROR` / `INVALID_REQUEST` | Invalid body, extra fields (`whitelist` + `forbidNonWhitelisted`), stock errors |
| 400 | `INSUFFICIENT_STOCK` | Not enough stock (`POST /cart/items`, `POST /checkout`) – `details` includes `available`, `requested` |
| 400 | `CART_EMPTY` | `POST /checkout` with empty cart |
| 400 | `INVALID_METHOD` | `POST /orders/:id/payment/init` unknown method |
| 400 | `ADDRESS_IN_USE` | `DELETE /profile/addresses/:id` with pending orders |
| 400 | `ORDER_ALREADY_CANCELLED` / `ORDER_NOT_CANCELLABLE` / `DELIVERY_IN_PROGRESS` | Cancel/update delivery when in transit |
| 401 | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `ACCOUNT_INACTIVE` | Missing/invalid/expired token, inactive account |
| 403 | `FORBIDDEN` | `BUYER` tries `/admin/*` (`RolesGuard`) |
| 404 | `NOT_FOUND` | Resource does not exist or does not belong to buyer (IDOR → 404, not 403) |
| 409 | `CONFLICT` / `EMAIL_ALREADY_EXISTS` | Duplicate email (`POST /auth/register`, `PATCH /profile`) |
| 409/400 | `CURRENT_PASSWORD_INCORRECT` | `PATCH /admin/account` wrong `currentPassword` |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected error (no stack in prod) |

**Validation:** `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` – extra fields → `400 VALIDATION_ERROR`.

Display `error.message` directly to the user (English). Use `error.code` for logic (e.g., `INSUFFICIENT_STOCK` → show `available` in `details`).

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
{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please try again later." } }
```
Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

`GET /products`, `GET /health`, `GET /profile`, `GET /cart` are **not** rate-limited.

---

## Receipts

- **Payment receipt:** `POST /orders/:id/payment/receipt` (`application/json`, field `receiptUrl` – English-only, auth `BUYER` owner of order) → `{ data: Payment }`
- **Flow:** Frontend uploads the image to external storage (e.g., S3, Cloudinary, Vercel Blob) and sends **only the URL** as JSON to the backend. Backend **does not** accept `multipart/form-data` and does not store files. Previously documented `comprovativo_url` / `receipt_url` aliases are removed – use `receiptUrl` only. Sending `file` → `400 VALIDATION_ERROR`.
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
| `POST /webhooks/payment/:gateway` (alias `POST /webhooks/pagamento/:gateway` hidden) | POST | `Public` | `x-signature` |
| `POST /webhooks/bridpay` (alias `POST /webhooks/pagamentos/bridpay` hidden) | POST | `Public` | `x-signature` |
| `POST /webhooks/appypay` | POST | `Public` | `x-signature` |
| `POST /webhooks/ekwanza` | POST | `Public` | `x-signature` |

**Gateway `param`:** `appypay|ekwanza|generic|bridpay|gpo|gpr|kwik`

**Env:** `PAYMENT_WEBHOOK_SECRET` (generic) or `PAYMENT_WEBHOOK_SECRET_<GATEWAY>` (e.g., `PAYMENT_WEBHOOK_SECRET_APPYPAY`). If not set, HMAC check is skipped in dev with `logger.warn`.

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

Deprecated PT aliases (`POST /auth/registar`, `POST /auth/esqueci-password`, `POST /auth/redefinir-password`, `GET /perfil`, `PATCH /perfil`) are hidden – do not use.

### products
| Method | Route | Auth | Query/Body | Response |
|--------|------|------|------------|----------|
| GET | `/products` | Public | `?q=&category=SUITS,SHIRTS&size=M&condition=NEW&price_min=&price_max=&sort=recent|price_asc|price_desc|name_asc|oldest&page=&limit=` | `200 { data: Product[], page, total, totalPages }` |
| GET | `/products/:id` | Public | `param id UUID` | `200 {data: Product}` |

`FilterProductsDto` query params (English-only; legacy PT aliases `categoria→category`, `tamanho→size`, `estado→condition`, `preco_min→price_min`, `ordenar→sort` still accepted by backend for compat but not documented for frontend – use English):
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

**AddCartItemDto**
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

Deprecated PT `POST /carrinho/itens` etc hidden.

### checkout
| Method | Route | Auth | Body | Response | Throttle |
|--------|------|------|------|----------|----------|
| POST | `/checkout` | JWT | `{type,scheduledDate,timeWindow,addressId?,deliveryZoneId?}` | `201 {data: Order}` | checkout 10/min |

**CheckoutDto (English-only)**
```json
{
  "type": "HOME_DELIVERY|STORE_PICKUP",
  "scheduledDate": "2026-09-01",
  "timeWindow": "09:00-12:00",
  "addressId": "uuid",
  "deliveryZoneId": "uuid"
}
```
- `type`: `HOME_DELIVERY` (delivery) or `STORE_PICKUP` (pickup). Legacy `domicilio`/`levantamento_loja` still accepted by backend but deprecated – frontend must send English.
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

**Upsert Delivery `POST /orders/:id/delivery` body:**
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

**Address DTO (English-only)**
```json
{
  "id": "uuid",
  "buyerId": "uuid",
  "label": "Home",
  "province": "Luanda",
  "municipality": "Talatona",
  "neighborhood": "Talatona",
  "street": "Street 123",
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

Deprecated PT `POST /pedidos/:id/pagamento/iniciar`, `GET /pagamentos/historico`, history aliases `/payments/entries`, `/payments/exits`, `/payments/wallet/history` hidden – use English.

`method` accepts: `multicaixa_express|gpo → MULTICAIXA_EXPRESS`, `multicaixa_reference|gpr|reference → MULTICAIXA_REFERENCE`, `bank_transfer → BANK_TRANSFER`, `cash_on_delivery → CASH_ON_DELIVERY`, `card → CARD`, `kwik → BANK_TRANSFER` (E-Kwanza). Invalid → `400 INVALID_METHOD`. GPO requires `phoneNumber`.

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
# 1. Register
curl -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Buyer","email":"buyer@test.com","password":"BuyerPass123!"}'

# 2. Login
curl -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@test.com","password":"BuyerPass123!"}'
# → { access_token, refresh_token }

# 3. Admin creates product (adminToken)
curl -X POST $BASE/admin/products \
  -H "Authorization: Bearer $adminToken" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://cdn.com/a.jpg","name":"Black Suit","description":"...","category":"SUITS","size":"M","condition":"NEW","stock":10,"price":45000}'

# 4. Public list (no auth)
curl "$BASE/products?q=Suit&category=SUITS&page=1&limit=12"

# 5. Cart (validates stock)
curl -X POST $BASE/cart/items \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"productId":"uuid","quantity":2}'
# insufficient stock → 400 { error: { code:"INSUFFICIENT_STOCK", message:"Insufficient stock" } }

# 6. Checkout (HOME_DELIVERY with address)
curl -X POST $BASE/checkout \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"type":"HOME_DELIVERY","scheduledDate":"2026-09-02","timeWindow":"09:00-12:00","addressId":"uuid"}'
# → { data: { id: "order-uuid", total, status: "AWAITING_PAYMENT" } }

# Alternative: STORE_PICKUP (no fee)
curl -X POST $BASE/checkout \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"type":"STORE_PICKUP","scheduledDate":"2026-09-02","timeWindow":"09:00-12:00"}'

# 7. Initiate payment
curl -X POST $BASE/orders/<orderId>/payment/init \
  -H "Authorization: Bearer $buyerToken" \
  -H "Content-Type: application/json" \
  -d '{"method":"BANK_TRANSFER"}'
# or GPO: {"method":"MULTICAIXA_EXPRESS","phoneNumber":"923456789"}

# 8. Upload receipt externally, then send URL only
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

**2. IDOR – ownership (must return 404, not 403)**
```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
# buyer2 tries to view buyer1's order → 404 (not 403, to avoid enumeration)
curl $BASE/orders/<orderId-buyer1> -H "Authorization: Bearer $buyer2Token"
# → 404 { error: { code:"NOT_FOUND", message:"Order not found" } }
```

**3. Admin guard**
```bash
BASE=https://api-sadivacloset.himersus.com/api/v1
curl $BASE/admin/products # no token → 401
curl $BASE/admin/products -H "Authorization: Bearer $buyerToken" # → 403
curl $BASE/admin/products -H "Authorization: Bearer $adminToken" # → 200
```

---

## Error Codes

| Code | Status | Message (EN) | Usage |
|------|--------|--------------|-------|
| `VALIDATION_ERROR` | 400 | Validation failed | DTO failed, `forbidNonWhitelisted` |
| `INVALID_REQUEST` | 400 | Invalid request | Generic 400 |
| `INSUFFICIENT_STOCK` | 400 | Insufficient stock | `POST /cart/items`, `POST /checkout` – `details` has `available`/`requested` |
| `CART_EMPTY` | 400 | Cart is empty | `POST /checkout` |
| `INVALID_METHOD` | 400 | Invalid payment method | `POST /orders/:id/payment/init` |
| `ADDRESS_IN_USE` | 400 | Address in use | `DELETE /profile/addresses/:id` |
| `MISSING_REFERENCE` | 400 | Missing externalReference | Webhook without ref |
| `MISSING_SIGNATURE` / `INVALID_SIGNATURE` | 400 | Missing/invalid signature | Webhook HMAC |
| `UNAUTHENTICATED` | 401 | Not authenticated | `JwtAuthGuard` – missing/invalid/expired token |
| `INVALID_CREDENTIALS` / `TOKEN_INVALID` / `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `ACCOUNT_INACTIVE` | 401 | (various) | Auth failures, inactive account |
| `FORBIDDEN` | 403 | Forbidden | `RolesGuard` – BUYER on `/admin/*` |
| `NOT_FOUND` | 404 | Not found | Resource missing or IDOR (ownership) |
| `CONFLICT` / `EMAIL_ALREADY_EXISTS` | 409 | Conflict / Email already exists | `POST /auth/register`, `PATCH /profile` |
| `CURRENT_PASSWORD_INCORRECT` | 400/409 | Current password is incorrect | `PATCH /admin/account` |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Throttler |
| `INTERNAL_ERROR` | 500 | Internal server error | `HttpExceptionFilter` (no stack in prod) |

---

## Frontend Notes

- **Always send `Authorization: Bearer <access_token>`** after login; use `refresh_token` to renew via `POST /auth/refresh`. On `401 UNAUTHENTICATED`, try refresh, else redirect to `/login`.
- **Pagination is English-only:** read `res.data`, `res.page`, `res.total`, `res.totalPages`. There is no `dados`/`pagina` fallback.
- **Display `error.message` directly** (English). Use `error.code` for logic (e.g., `INSUFFICIENT_STOCK` → show `available` in `details`).
- **Cache:** `GET /products` has server `Cache 60s` (Redis) – frontend may cache but invalidation is server-side on admin product mutations.
- **Receipts:** send `JSON { "receiptUrl": "https://..." }` to `POST /orders/:id/payment/receipt`. Backend does not accept file uploads. Validate `IsUrl` on frontend before sending; 5MB limit should be enforced at external storage.
- **Aliases:** Never use PT aliases (`/produtos`, `/carrinho`, etc.) – they are deprecated and hidden from Swagger. Use English routes exclusively. Legacy `tipo`/`data_agendada`/`janela_horario`/`produto_id` are still accepted by backend for compat but not part of contract – send `type`/`scheduledDate`/`timeWindow`/`productId`.
- **Webhooks:** are **public** (no JWT) – frontend **never** calls them; only gateways with `x-signature`.
- **Rate limiting:** show `RATE_LIMIT_EXCEEDED` with retry after `X-RateLimit-Reset` header.
- **CORS:** `origin: true` in dev; restricted via `env` in prod.
- **Swagger is contract:** `GET https://api-sadivacloset.himersus.com/api/docs-json` (or local `http://localhost:3001/api/docs-json`) can be imported into Postman/Insomnia or used with `openapi-generator` for SDK.

**Base URLs:**
- **Staging (primary):** `https://api-sadivacloset.himersus.com/api/v1` – Swagger `https://api-sadivacloset.himersus.com/api/docs`
- **Local (alternative):** `http://localhost:3001/api/v1` (Docker host) or `http://localhost:3002/api/v1` if `PORT=3002` in `.env` – Swagger `http://localhost:3001/api/docs`

> Generate SDK: `npx openapi-generator-cli generate -i https://api-sadivacloset.himersus.com/api/docs-json -g typescript-axios -o ./frontend-sdk`
> Local alternative: `npx openapi-generator-cli generate -i http://localhost:3001/api/docs-json -g typescript-axios -o ./frontend-sdk`
