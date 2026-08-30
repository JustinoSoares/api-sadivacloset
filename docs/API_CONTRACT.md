# SadivaCloset API – Contrato Frontend (v0.1.0)

**Base URL:** `http://localhost:3001/api/v1` (global prefix)  
**Swagger UI:** `http://localhost:3001/api/docs` (sem prefixo)  
**OpenAPI JSON:** `http://localhost:3001/api/docs-json`  
**Health:** `GET /health` (sem prefixo, público)  
**Versão:** 0.1.0 | **Idioma código:** Inglês (tabelas, classes, endpoints) | **Mensagens utilizador:** Português (`{ erro: { codigo, mensagem } }`)

> **Nota sobre rotas duplicadas:** O código mantém aliases em português (`/produtos`, `/carrinho`, `/pedidos`, `/perfil/*`, `/admin/produtos`…) para retrocompatibilidade, mas **estão escondidas da documentação** (`@ApiExcludeController`/`@ApiExcludeEndpoint`). Use sempre a versão **Inglesa** abaixo como contrato definitivo. A resposta mantém chaves bilíngues (`data`/`dados`, `page`/`pagina`) para facilitar migração.

---

## Sumário
- [Autenticação](#autenticação)
- [Headers](#headers)
- [Paginação](#paginação)
- [Erros](#erros)
- [Rate Limiting](#rate-limiting)
- [Uploads](#uploads)
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
- [Exemplos Fluxo Crítico](#exemplos-fluxo-crítico)
- [Códigos de Erro](#códigos-de-erro)

---

## Autenticação

**Tipo:** `JWT Bearer`

```
Authorization: Bearer <access_token>
```

| Endpoint | Método | Auth | Descrição |
|----------|--------|------|-----------|
| `/auth/register` | POST | Público | Registar BUYER |
| `/auth/login` | POST | Público | Login → `{ access_token, refresh_token }` |
| `/auth/refresh` | POST | Público | Renovar access_token |
| `/auth/logout` | POST | Público | Revoga refresh_token |
| `/auth/forgot-password` | POST | Público | Solicita token reset (15min, Redis) |
| `/auth/reset-password` | POST | Público | Redefine password com token |
| `/profile` | GET/PATCH | JWT | Perfil do utilizador |

**Register – Request**
```json
{
  "name": "Buyer Teste",
  "email": "buyer@test.com",
  "password": "BuyerPass123!"
}
```
**Register – Response `201`**
```json
{
  "data": { "id": "uuid", "name": "Buyer Teste", "email": "buyer@test.com", "role": "BUYER", "createdAt": "..." }
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
**Forgot – Request** `POST /auth/forgot-password` (ou alias `POST /auth/esqueci-password` – escondido)
```json
{ "email": "buyer@test.com" }
```
**Reset – Request**
```json
{ "token": "hex-64", "newPassword": "NovaPass123!" }
```

**Profile – Response `200`**
```json
{
  "data": { "id": "uuid", "name": "...", "email": "...", "role": "BUYER", "createdAt": "...", "isActive": true },
  "dados": { "...": "..." }
}
```

---

## Headers

**Autenticados:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Webhooks (público, HMAC):**
```
x-signature: <hex HMAC_SHA256(rawBody, PAYMENT_WEBHOOK_SECRET)>
Content-Type: application/json
```

**Segurança (helmet):** `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc. `X-Powered-By` removido.

---

## Paginação

**Query:** `?page=1&limit=20` (`PaginationDto` – `page` min 1, `limit` 1-100, default 20)

**Resposta bilíngue (use EN ou PT):**
```json
{
  "data": [{ "id": "1", "name": "Black Suit" }],
  "dados": [{ "id": "1", "name": "Black Suit" }],
  "page": 1,
  "pagina": 1,
  "total": 25,
  "totalPages": 2,
  "total_paginas": 2
}
```
Alguns endpoints usam `meta: { page, limit, total, totalPages }` (legado) – prefira o formato acima.

---

## Erros

**Formato único (PT):**
```json
{
  "erro": {
    "codigo": "ERRO_VALIDACAO",
    "mensagem": "Erro de validação",
    "detalhes": [{ "campo": "email", "erros": ["email deve ser um email válido"] }]
  }
}
```

| Status | `codigo` | Quando |
|--------|----------|--------|
| 400 | `PEDIDO_INVALIDO` / `ERRO_VALIDACAO` | Body inválido, whitelist, stock |
| 401 | `NAO_AUTENTICADO` | Token ausente/inválido/expirado |
| 403 | `ACESSO_NEGADO` | `BUYER` tenta `/admin/*` |
| 404 | `NAO_ENCONTRADO` | Recurso não existe ou não pertence ao buyer (IDOR → 404, não 403) |
| 409 | `CONFLITO` / `EMAIL_JA_EXISTE` | Email duplicado |
| 429 | `LIMITE_EXCEDIDO` | Rate limit |
| 500 | `ERRO_INTERNO` | Erro inesperado (sem stack em prod) |

**Validação:** `ValidationPipe` com `whitelist: true, forbidNonWhitelisted: true` – campos extra → `400 ERRO_VALIDACAO`.

---

## Rate Limiting (Redis)

**Ativo apenas em `/auth/*` e `/checkout` (`skipIf` nos outros):**

| Throttler | Limit | TTL | Rotas |
|-----------|-------|-----|-------|
| `auth` | 20 | 60s | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/reset-password` |
| `esqueci` | 5 | 15min | `POST /auth/forgot-password` (e alias `POST /auth/esqueci-password` – escondido) |
| `checkout` | 10 | 60s | `POST /checkout` |
| `default` | 60 | 60s | fallback |

Resposta `429`:
```json
{ "erro": { "codigo": "LIMITE_EXCEDIDO", "mensagem": "Demasiadas tentativas. Tente novamente mais tarde." } }
```
Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

`GET /products`, `GET /health`, `GET /profile` **não** são limitados.

---

## Uploads

- **Comprovativo pagamento:** `POST /orders/:id/payment/receipt` (`multipart/form-data`, campo `file`, 5MB, auth `BUYER` dono do pedido) → `{ comprovativo_url }`
- **Servidos em:** `GET /uploads/<file>` e `GET /api/v1/uploads/<file>` (estático `express.static`)

---

## Webhooks

**Público, sem JWT, protegido por HMAC. Idempotente por `referencia_externa`.**

| Rota (canónica EN, PT escondida) | Método | Auth | HMAC Header |
|----------------------------------|--------|------|-------------|
| `POST /webhooks/payment/:gateway` (alias `POST /webhooks/pagamento/:gateway` escondido) | POST | `Public` | `x-signature` |
| `POST /webhooks/bridpay` (alias `POST /webhooks/pagamentos/bridpay` escondido) | POST | `Public` | `x-signature` |
| `POST /webhooks/appypay` | POST | `Public` | `x-signature` |
| `POST /webhooks/ekwanza` | POST | `Public` | `x-signature` |

**Gateway `param`:** `appypay|ekwanza|generic|bridpay|gpo|gpr|kwik`

**Env:** `PAYMENT_WEBHOOK_SECRET` (genérico) ou `PAYMENT_WEBHOOK_SECRET_<GATEWAY>` (ex: `PAYMENT_WEBHOOK_SECRET_APPYPAY`). `rawBody` = `JSON.stringify(payload)` exato enviado.

**Geração assinatura (Node):**
```js
const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest('hex');
// header: 'x-signature: ' + sig  // ou 'sha256=' + sig
```

**Payload genérico:**
```json
{
  "referencia_externa": "merchant-tx-id-15chars",
  "status": "pago",
  "valor": 50000
}
```
`status` aceita `paid|pago|settled|success|confirmed` → marca `Payment.status=PAID`, `Order.status=PAID`, cria `WalletTransaction`, notifica comprador, enfileira `BullMQ` `pagamento-confirmado`. `failed|falhado|rejected` → `FAILED`. Sem `referencia_externa` → `400 REFERENCIA_EM_FALTA`. Sem `x-signature` com secret configurado → `400 ASSINATURA_EM_FALTA`, inválida → `400 ASSINATURA_INVALIDA`.

**Idempotência:** `referencia_externa` é chave – `Redis SET webhook:pagamento:${gateway}:${ref} EX 7d` + coluna `webhook_processed_at`. Segunda chamada com mesma ref → `200 { ok:true, idempotente:true, message:"Já processado" }` sem reprocessar.

---

## Endpoints

### auth
| Método | Rota | Auth | Body/Query | Resposta |
|--------|------|------|------------|----------|
| POST | `/auth/register` | Public | `{name,email,password}` | `201 {data}` |
| POST | `/auth/login` | Public | `{email,password}` | `200 {access_token,refresh_token}` |
| POST | `/auth/refresh` | Public | `{refresh_token}` | `200 {access_token,refresh_token}` |
| POST | `/auth/logout` | Public | `{refresh_token}` | `200 {mensagem}` |
| POST | `/auth/forgot-password` | Public (esqueci 5/15min) | `{email}` | `200 {mensagem}` |
| POST | `/auth/reset-password` | Public | `{token,newPassword}` | `200 {mensagem}` |
| GET | `/profile` | JWT | - | `200 {data}` |
| PATCH | `/profile` | JWT | `{name?,email?}` | `200 {data}` |

Aliases PT escondidos: `POST /auth/registar`, `POST /auth/esqueci-password`, `POST /auth/redefinir-password`, `GET /perfil`, `PATCH /perfil` → mesmas, não documentadas.

### products
| Método | Rota | Auth | Query/Body | Resposta |
|--------|------|------|------------|----------|
| GET | `/products` | Public | `?q=&category=SUITS,SHIRTS&size=M&condition=NEW&price_min=&price_max=&sort=recent|price_asc|price_desc|name_asc|oldest&page=&limit=` | `200 PaginatedResponse<Product>` |
| GET | `/products/:id` | Public | `param id UUID` | `200 {data}` |

`FilterProductsDto` normaliza `categoria→category`, `tamanho→size`, `estado→condition`, `preco_min→price_min`, `ordenar→sort`. Cache `60s` `cache:products:*` (Redis). `POST /produtos` alias escondido.

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
| Método | Rota | Auth | Resposta |
|--------|------|------|----------|
| GET | `/categories` | Public | `200 {data: ["SUITS","SHIRTS",...]}` |
| GET | `/delivery-zones` | Public | `200 {data: [{id,neighborhood,price}]}` |

Aliases PT `GET /categorias`, `GET /zonas-entrega` escondidos.

### cart
| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | `/cart` | JWT (BUYER) | - | `200 {items,itens,subtotal,totalQuantity}` |
| POST | `/cart/items` | JWT | `{product_id, quantity}` | `201 {data}` |
| PATCH | `/cart/items/:id` | JWT | `{quantity}` | `200 {data}` |
| DELETE | `/cart/items/:id` | JWT | - | `200 {mensagem}` |

Aliases PT `POST /carrinho/itens` etc escondidos. Valida stock → `400 STOCK_INSUFICIENTE`.

**AddCartItemDto**
```json
{ "product_id": "uuid", "quantity": 2 }
// aliases: produto_id, productId, quantidade
```

### checkout
| Método | Rota | Auth | Body | Resposta | Throttle |
|--------|------|------|------|----------|----------|
| POST | `/checkout` | JWT | `{tipo,data_agendada,janela_horario,endereco_id?,zona_entrega_id?}` | `201 {data: Order}` | checkout 10/min |

**CheckoutDto**
```json
{
  "tipo": "domicilio|levantamento_loja", // aliases: type HOME_DELIVERY/STORE_PICKUP
  "data_agendada": "2026-09-01", // aliases: scheduled_date, scheduledDate
  "janela_horario": "09:00-12:00", // aliases: time_window, timeWindow
  "endereco_id": "uuid", // alias address_id
  "zona_entrega_id": "uuid" // alias delivery_zone_id
}
```
Transação: valida stock, decrementa `product.stock`, cria `order` (`AWAITING_PAYMENT`) + `order_items` + `delivery` (`SCHEDULED`), esvazia `cart_items`. Erros: `CARRINHO_VAZIO`, `STOCK_INSUFICIENTE`, `ERRO_VALIDACAO`.

### orders / profile/orders
| Método | Rota | Auth | Resposta |
|--------|------|------|----------|
| GET | `/orders/:id` | JWT (dono) | `200 {data: OrderDetail}` |
| PATCH | `/orders/:id/cancel` | JWT (dono) | `200 {data}` |
| POST | `/orders/:id/delivery` | JWT (dono) | `200 {data}` |
| GET | `/profile/orders` | JWT | `200 PaginatedResponse<Order>` |

Aliases PT `GET /pedidos/:id`, `PATCH /pedidos/:id/cancelar`, `POST /pedidos/:id/entrega`, `GET /perfil/pedidos` escondidos. Ownership: `order.buyerId !== user.sub` → `404 NAO_ENCONTRADO` (não 403, evita enumeração).

**OrderDetail**
```json
{
  "id": "uuid",
  "buyerId": "uuid",
  "subtotal": 90000,
  "deliveryFee": 2500,
  "total": 92500,
  "status": "AWAITING_PAYMENT|PAID|...",
  "createdAt": "...",
  "items": [{ "productId": "uuid", "productName": "...", "unitPrice": 45000, "discount": 10, "quantity": 2 }],
  "delivery": { "type": "HOME_DELIVERY", "addressId": "uuid", "scheduledDate": "2026-09-01", "timeWindow": "09:00-12:00", "status": "SCHEDULED" },
  "payment": { "method": "BANK_TRANSFER", "amount": 92500, "status": "PENDING" }
}
```

### profile/addresses
| Método | Rota | Auth | Body | Resposta |
|--------|------|------|------|----------|
| GET | `/profile/addresses` | JWT | - | `200 {data: Address[]}` |
| POST | `/profile/addresses` | JWT | `{label,province,municipality,neighborhood,street,reference?,latitude?,longitude?}` | `201 {data}` |
| PATCH | `/profile/addresses/:id` | JWT (dono) | `{...}` | `200 {data}` |
| DELETE | `/profile/addresses/:id` | JWT (dono) | - | `200` |
| PATCH | `/profile/addresses/:id/default` | JWT (dono) | - | `200 {data}` |

Aliases PT `perfil/enderecos` escondidos. Ownership idem.

### payments / wallet
| Método | Rota | Auth | Body/Query | Resposta |
|--------|------|------|------------|----------|
| POST | `/orders/:id/payment/init` | JWT (dono) | `{metodo,phoneNumber?,iban?,descricao?}` | `201 {data: Payment}` |
| GET | `/orders/:id/payment` | JWT (dono) | - | `200 {data}` |
| POST | `/orders/:id/payment/receipt` | JWT (dono) | `multipart file` | `200 {data}` |
| GET | `/payments/historico` / `/payments/entradas` / `/payments/saidas` / `/payments/carteira/historico` | JWT | `?page&limit&tipo=entrada|saida` | `200 Paginated` |
| GET | `/wallet/historico` | JWT | `?page&limit` | `200 {local, bridpay}` |

Aliases PT `POST /pedidos/:id/pagamento/iniciar`, `GET /pagamentos/historico` etc escondidos. `metodo` aceita `multicaixa_express|gpo|referencia_multicaixa|gpr|transferencia|pagamento_entrega|cartao|kwik`.

**Payment Response**
```json
{
  "id": "uuid",
  "orderId": "uuid",
  "method": "BANK_TRANSFER",
  "amount": 92500,
  "status": "PENDING|PROCESSING|PAID|FAILED",
  "externalReference": "15chars",
  "receiptUrl": null,
  "createdAt": "..."
}
```

### webhooks
| Método | Rota | Auth | Headers | Body | Resposta |
|--------|------|------|---------|------|----------|
| POST | `/webhooks/payment/:gateway` | Public | `x-signature` | `{referencia_externa,status}` | `200 {ok:true,status:"paid",idempotente?}` |
| POST | `/webhooks/bridpay` | Public | `x-signature` | `{merchantTxId,providerTxId,status}` | `200 {ok}` |
| POST | `/webhooks/appypay` | Public | `x-signature` | `{merchantTransactionId,operationStatus}` | `200` |
| POST | `/webhooks/ekwanza` | Public | `x-signature` | `{code,operationCode,status}` | `200` |

Aliases PT `POST /webhooks/pagamento/:gateway`, `POST /webhooks/pagamentos/bridpay` escondidos. Ver secção Webhooks acima para HMAC/idempotência.

### favorites / notifications
| Método | Rota | Auth | Resposta |
|--------|------|------|----------|
| GET/POST/DELETE | `/favorites` etc | JWT | `200` |
| GET | `/notifications` | JWT | `200` |
| PATCH | `/notifications/:id/read` | JWT | `200` |

Aliases PT `favoritos`, `notificacoes` escondidos.

### admin/*
Todas exigem `Authorization: Bearer <adminToken>` + `role=admin` (via `@Roles('admin')` + fallback `isAdminPath`). Sem token → `401 NAO_AUTENTICADO`, com `BUYER` → `403 ACESSO_NEGADO`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/products` | Lista paginada produtos (filtros `?q&category`) |
| POST | `/admin/products` | Cria produto |
| PATCH | `/admin/products/:id` | Atualiza |
| DELETE | `/admin/products/:id` | Remove + invalida cache |
| GET | `/admin/orders` | Lista pedidos `?estado&from&to&page&limit` |
| PATCH | `/admin/orders/:id/status` | Atualiza `estado` (`aguardando_pagamento|pago|...`) |
| GET | `/admin/deliveries` | Lista entregas `?estado&from&to` |
| PATCH | `/admin/deliveries/:id/status` | Atualiza entrega |
| GET | `/admin/statistics` | Dashboard: `receita_total` (soma `total` onde `PAID|COMPLETED`), `total_produtos`, `total_membros`, `total_pedidos` + `variacao` % vs período anterior (`?dias=30` ou `?data_inicio&data_fim`) + `pedidosRecentes` paginado |
| GET | `/admin/store` | `StoreConfig` |
| PATCH | `/admin/store` | Atualiza `name,contactEmail,phone,address` |
| GET | `/admin/account` | Conta admin autenticado |
| PATCH | `/admin/account` | Atualiza `name,email` + troca `currentPassword/newPassword` (exige `currentPassword` correto) |
| GET | `/admin/preferences` | `AdminPreferences` |
| PATCH | `/admin/preferences` | `notifyNewOrders,notifyLowStock,notifyNewMessages,defaultDeliveryFee,activePaymentMethods[]` |
| GET | `/admin/members` | Lista `BUYER` paginada `?q` (nome/email) com `totalPedidos` e `totalGasto` via `groupBy buyerId` |
| GET | `/admin/members/:id/orders` | Histórico pedidos do membro |
| GET | `/admin/audit` | Logs `?entity&from&to&page&limit` |
| PATCH | `/admin/payments/:id/validate` | Valida pagamento manual → `Payment PAID` + `Order PAID` |
| GET | `/admin/payments/historico` etc | Históricos |

Aliases PT (`/admin/produtos`, `/admin/pedidos`, `/admin/entregas`, `/admin/estatisticas`, `/admin/loja`, `/admin/conta`, `/admin/preferencias`, `/admin/membros`, `/admin/auditoria`, `/admin/pagamentos`) escondidos – mantêm compatibilidade mas não aparecem em `/api/docs`.

**Admin Statistics – Response `200`**
```json
{
  "receita_total": 100000,
  "receita": { "valor": 30000, "valorAnterior": 20000, "percentual": 50, "crescimento": true, "valorTotal": 100000 },
  "total_produtos": 50,
  "produtos": { "valor": 10, "valorAnterior": 5, "percentual": 100 },
  "total_membros": 100,
  "periodo": { "dias": 30, "inicio": "...", "fim": "...", "inicioAnterior": "..." },
  "pedidosRecentes": { "data": [...], "total": 80, "page": 1, "totalPages": 4 }
}
```

### health
| Método | Rota | Auth | Resposta |
|--------|------|------|----------|
| GET | `/health` | Public (excluído do prefixo) | `200 {status:"ok",database:"up",timestamp}` |

---

## Exemplos Fluxo Crítico

**1. Registo → Login → Criar produto → Listar → Carrinho → Checkout → Pedido → Webhook**
```bash
# 1. Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Buyer","email":"buyer@test.com","password":"BuyerPass123!"}'

# 2. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -d '{"email":"buyer@test.com","password":"BuyerPass123!"}'
# → { access_token, refresh_token }

# 3. Admin cria produto (adminToken)
curl -X POST http://localhost:3001/api/v1/admin/products \
  -H "Authorization: Bearer $adminToken" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://cdn.com/a.jpg","name":"Black Suit","description":"...","category":"SUITS","size":"M","condition":"NEW","stock":10,"price":45000}'

# 4. Público lista
curl http://localhost:3001/api/v1/products?q=Suit

# 5. Carrinho (valida stock)
curl -X POST http://localhost:3001/api/v1/cart/items \
  -H "Authorization: Bearer $buyerToken" \
  -d '{"product_id":"uuid","quantity":2}'
# stock insuficiente → 400 { erro: { codigo:"STOCK_INSUFICIENTE" } }

# 6. Checkout
curl -X POST http://localhost:3001/api/v1/checkout \
  -H "Authorization: Bearer $buyerToken" \
  -d '{"tipo":"levantamento_loja","data_agendada":"2026-09-02","janela_horario":"09:00-12:00"}'
# → { data: { id: "order-uuid", total, status: "AWAITING_PAYMENT" } }

# 7. Inicia pagamento
curl -X POST http://localhost:3001/api/v1/orders/<orderId>/payment/init \
  -H "Authorization: Bearer $buyerToken" \
  -d '{"metodo":"transferencia"}'

# 8. Webhook (HMAC)
PAYLOAD='{"referencia_externa":"<externalReference>","status":"pago"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | cut -d' ' -f2)
curl -X POST http://localhost:3001/api/v1/webhooks/payment/generic \
  -H "x-signature: $SIG" -H "Content-Type: application/json" \
  -d "$PAYLOAD"
# 2ª chamada mesma ref → 200 { ok:true, idempotente:true }

# 9. Verifica pedido pago
curl http://localhost:3001/api/v1/orders/<orderId> -H "Authorization: Bearer $buyerToken"
# → status PAID
```

**2. IDOR – ownership**
```bash
# buyer2 tenta ver pedido de buyer1 → 404 (não 403, evita enumeração)
curl http://localhost:3001/api/v1/orders/<orderId-buyer1> -H "Authorization: Bearer $buyer2Token"
# → 404 { erro: { codigo:"NAO_ENCONTRADO", mensagem:"Pedido não encontrado" } }
```

**3. Admin guard**
```bash
curl http://localhost:3001/api/v1/admin/products # sem token → 401
curl http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $buyerToken" # → 403
curl http://localhost:3001/api/v1/admin/products -H "Authorization: Bearer $adminToken" # → 200
```

---

## Códigos de Erro

| Código | Status | Mensagem PT | Uso |
|--------|--------|-------------|-----|
| `ERRO_VALIDACAO` | 400 | Erro de validação | DTO falha, `forbidNonWhitelisted` |
| `PEDIDO_INVALIDO` | 400 | Pedido inválido | genérico 400 |
| `STOCK_INSUFICIENTE` | 400 | Stock insuficiente... | `POST /cart/items`, `POST /checkout` |
| `NAO_AUTENTICADO` | 401 | Token não fornecido/inválido/expirado | `JwtAuthGuard` |
| `ACESSO_NEGADO` | 403 | Sem permissão | `RolesGuard` |
| `NAO_ENCONTRADO` | 404 | ... não encontrado | Ownership → 404 |
| `EMAIL_JA_EXISTE` | 409 | Este email já está em uso | `POST /auth/register` |
| `LIMITE_EXCEDIDO` | 429 | Demasiadas tentativas... | Throttler |
| `ERRO_INTERNO` | 500 | Ocorreu um erro inesperado. | `HttpExceptionFilter` (sem stack em prod) |

---

## Notas Frontend

- **Sempre envie `Authorization: Bearer <access_token>`** após login; use `refresh_token` para renovar via `POST /auth/refresh`.
- **Trate paginação bilíngue:** prefira `res.data` e `res.page`, mas suporte `res.dados`/`pagina` para retrocompatibilidade.
- **Exiba `mensagem` diretamente ao utilizador** (já em PT). Use `codigo` para lógica (ex: `STOCK_INSUFICIENTE` → mostrar stock disponível em `detalhes`).
- **Cache:** `GET /products` tem `Cache 60s` no servidor (Redis) – frontend pode cachear mas não precisa invalidar.
- **Uploads:** use `FormData` com campo `file` para `POST /orders/:id/payment/receipt`.
- **Webhooks:** são **públicos** (sem JWT) – frontend **nunca** chama; apenas gateways com `x-signature`.
- **Rate limiting:** mostre `LIMITE_EXCEDIDO` com retry após `X-RateLimit-Reset`.
- **CORS:** `origin: true` em dev; em prod será restrito via `env`.
- **Swagger é contrato:** `GET /api/docs-json` pode ser importado no Postman/Insomnia ou gerado com `openapi-generator` para SDK.

**Base URL dev:** `http://localhost:3001/api/v1` (Docker host) ou `http://localhost:3002/api/v1` se `PORT=3002` no `.env`.

> Gere SDK: `npx openapi-generator-cli generate -i http://localhost:3001/api/docs-json -g typescript-axios -o ./frontend-sdk`
