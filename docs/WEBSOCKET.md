# SadivaCloset Realtime — WebSocket Contract (v0.1.0)

> **Namespace:** `/realtime` | **Transports:** `websocket` + `polling` | **Auth:** JWT `Bearer` | **Lib:** `socket.io 4.x` + `@nestjs/websockets`
> **URLs:** `wss://api-sadivacloset.himersus.com/realtime` (staging) | `ws://localhost:3001/realtime` (Docker) | `ws://localhost:3002/realtime` (host `.env PORT=3002`)
> **Código:** `src/modules/realtime/realtime.gateway.ts:15` | `src/modules/realtime/realtime.module.ts:11` | Emitido por `src/modules/payments/payments.service.ts:550` (paid) + `src/modules/notifications/notifications.service.ts:26`

Este documento é **único** para integrar realtime no frontend. O frontend deve **usar este doc + `SADIVACLOSET.md`**. Não chame webhooks; apenas consuma eventos.

---

## 1. Conexão — 3 formas (escolha 1)

**Secrets:** `JWT_SECRET` + `JWT_EXPIRES_IN=15m`. Use `access_token` do `POST /auth/login` `src/modules/auth/auth.controller.ts:13`.

### 1.1 `handshake.auth.token` (recomendado)
```ts
import { io } from "socket.io-client";
const socket = io("https://api-sadivacloset.himersus.com/realtime", {
  transports: ["websocket","polling"],
  auth: { token: `Bearer ${accessToken}` } // ou sem Bearer, ambos aceitos
});
```

### 1.2 `handshake.headers.Authorization`
```ts
const socket = io("https://api-sadivacloset.himersus.com/realtime", {
  extraHeaders: { Authorization: `Bearer ${accessToken}` },
  transports: ["websocket","polling"],
});
```

### 1.3 `handshake.query.token` ou `auth:join` pós-conexão
```ts
const socket = io("https://api-sadivacloset.himersus.com/realtime");
socket.on("connected", () => {
  socket.emit("auth:join", { token: `Bearer ${accessToken}` }, (res) => {
    console.log(res); // { ok:true, userId:"uuid" } ou { ok:false, message:"Token inválido" }
  });
});
socket.on("joined", (d) => console.log("rooms", d.rooms)); // ["buyer:uuid"]
```

**Respostas do gateway `realtime.gateway.ts:48`:**
- Sem token: `connected { message:"Conectado - envie auth:join..." }` (anon, não recebe `payment:confirmed`)
- Com token válido: `connected { userId:"uuid", message:"Conectado ao realtime" }` + auto `join` em `buyer:${sub}` e se `role===ADMIN` também `admins`.

---

## 2. Rooms

| Room | Quem entra | Como |
|------|------------|------|
| `buyer:${userId}` | Dono do pedido | Auto no `handleConnection` se JWT válido ou após `auth:join` |
| `admins` | Todo `role=ADMIN` | Auto se `payload.role===ADMIN` |

O servidor faz `server.to(`buyer:${buyerId}`).emit(...)` `realtime.gateway.ts:96` — apenas o dono e admins veem o evento.

---

## 3. Eventos — Todos

### 3.1 Cliente → Servidor

| Emit | Payload | Resposta | Descrição |
|------|---------|----------|-----------|
| `auth:join` | `{ token: "Bearer <access_token>" }` ou `string` | `joined { userId, rooms }` ou `error { message }` | `SubscribeMessage("auth:join")` `realtime.gateway.ts:73` |

### 3.2 Servidor → Cliente (ouvir com `socket.on`)

#### `connected` — handshake
```json
{ "userId": "uuid", "message": "Conectado ao realtime" }
```
ou anon
```json
{ "message": "Conectado - envie auth:join com token para receber pagamentos" }
```

#### `joined`
```json
{ "userId": "uuid", "rooms": ["buyer:uuid"] }
```

#### `payment:confirmed` + `payment:paid` (alias)
Emitido por `PaymentsService` em **4 lugares** `payments.service.ts:550` (admin validar), `~686` (E-Kwanza), `~892` (AppyPay), `~1138` (generic/Honor proxy):
```ts
// realtime.gateway.ts:89 emitPaymentConfirmed
{
  "type": "payment:confirmed",
  "orderId": "uuid",        // Order.id (salve de POST /checkout)
  "paymentId": "uuid",      // Payment.id
  "amount": 83500,          // int Kz, igual Order.total
  "gateway": "admin_validate" | "ekwanza" | "appypay_gpo" | "appypay_gpr" | "generic" | "gpo" | "gpr",
  "externalReference": "15chars", // Payment.externalReference (15 chars base36)
  "orderStatus": "PAID",
  "confirmedAt": "2026-09-10T12:00:00.000Z"
}
```
`payment:paid` é alias idêntico — ouça um dos dois.

#### `payment:failed`
```json
{
  "type": "payment:failed",
  "orderId": "uuid",
  "paymentId": "uuid",
  "gateway": "appypay_gpo",
  "reason": "AppyPay operationStatus 4",
  "failedAt": "2026-09-10T12:00:00.000Z"
}
```
Emitido em `realtime.gateway.ts:101` quando `operationStatus 3/4/5` ou E-Kwanza `status=failed`.

#### `notification:new`
Emitido por `NotificationsService.criar` `notifications.service.ts:29` (via `RealtimeGateway.emitNotification`):
```json
{
  "type": "notification:new",
  "notification": {
    "id": "uuid",
    "buyerId": "uuid",
    "title": "Pagamento confirmado",
    "description": "O pagamento do pedido #abc123 foi confirmado via GPO (AppyPay)",
    "isRead": false,
    "createdAt": "2026-09-10T12:00:00.000Z"
  }
}
```
Títulos reais: `Pagamento confirmado`, `Pagamento validado`, `Pagamento confirmado via E-Kwanza`, etc. Use para badge + toast sem polling.

#### `order:statusUpdated` (admin → buyer)
Emitido quando `PATCH /admin/orders/:id/status` `src/modules/admin/orders/admin-orders.controller.ts:22` muda `AWAITING_PAYMENT→PAID→PREPARING→SHIPPING→COMPLETED→CANCELLED`:
```json
{
  "type": "order:statusUpdated",
  "orderId": "uuid",
  "status": "PREPARING",
  "previousStatus": "PAID",
  "updatedBy": "admin-uuid",
  "updatedAt": "2026-09-10T12:00:00.000Z"
}
```

#### `delivery:statusUpdated`
Emitido quando `PATCH /admin/deliveries/:id/status` `src/modules/admin/deliveries/admin-deliveries.controller.ts:22`:
```json
{
  "type": "delivery:statusUpdated",
  "deliveryId": "uuid",
  "orderId": "uuid",
  "status": "ON_THE_WAY",
  "previousStatus": "SCHEDULED"
}
```
`status: SCHEDULED|ON_THE_WAY|DELIVERED|FAILED|CANCELLED` `delivery-zones/delivery-zones.service.ts:11`.

#### `admin:newOrder`
Emitido para sala `admins` quando `POST /checkout` cria pedido:
```json
{
  "type": "admin:newOrder",
  "orderId": "uuid",
  "buyerId": "uuid",
  "total": 83500,
  "createdAt": "2026-09-10T12:00:00.000Z"
}
```

#### `error`
```json
{ "message": "Token inválido" }
```

---

## 4. Integração Frontend — Copie e cole

### 4.1 React Hook (recomendado) `useRealtime.ts`

```ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type PaymentConfirmed = {
  orderId: string; paymentId: string; amount: number;
  gateway: string; externalReference?: string; confirmedAt: string;
};

export function useRealtime(accessToken: string | null, onPaymentConfirmed?: (p: PaymentConfirmed) => void) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    const url = import.meta.env.VITE_REALTIME_URL ?? "https://api-sadivacloset.himersus.com/realtime";
    const socket = io(url, {
      transports: ["websocket","polling"],
      auth: { token: `Bearer ${accessToken}` },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connected", (d) => console.log("[realtime] connected", d));
    socket.on("joined", (d) => console.log("[realtime] joined", d.rooms));
    socket.on("payment:confirmed", (d: PaymentConfirmed) => {
      console.log("[realtime] payment:confirmed", d);
      onPaymentConfirmed?.(d);
      // ex: queryClient.invalidateQueries(["orders", d.orderId]);
      // toast.success(`Pagamento ${d.orderId.slice(0,8)} confirmado!`);
    });
    socket.on("payment:paid", (d) => onPaymentConfirmed?.(d));
    socket.on("payment:failed", (d) => console.log("[realtime] payment:failed", d));
    socket.on("notification:new", (d) => {
      console.log("[realtime] notification", d.notification);
      // store.addNotification(d.notification); badge++
    });
    socket.on("order:statusUpdated", (d) => console.log("[order] status", d));
    socket.on("delivery:statusUpdated", (d) => console.log("[delivery] status", d));
    socket.on("error", (e) => console.error("[realtime] error", e));

    // Reconecta com novo token quando refresh
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [accessToken]);

  // Chame quando access_token renovar via POST /auth/refresh
  const updateToken = (newToken: string) => {
    socketRef.current?.emit("auth:join", { token: `Bearer ${newToken}` });
  };

  return { socket: socketRef.current, connected, updateToken };
}

// Uso:
// const { connected } = useRealtime(accessToken, (p) => navigate(`/orders/${p.orderId}?paid=1`));
```

### 4.2 Vue 3 Composable

```ts
// composables/useRealtime.ts
import { ref, watch } from "vue";
import { io, Socket } from "socket.io-client";

export function useRealtime(token: Ref<string | null>) {
  const socket = ref<Socket | null>(null);
  watch(token, (t) => {
    if (!t) { socket.value?.disconnect(); return; }
    const s = io(import.meta.env.VITE_REALTIME_URL, { auth:{ token:`Bearer ${t}` } });
    s.on("payment:confirmed", (p) => console.log(p));
    s.on("notification:new", (n) => console.log(n));
    socket.value = s;
  }, { immediate:true });
  return { socket };
}
```

### 4.3 Vanilla JS + polling fallback

```js
import { io } from "socket.io-client";
const accessToken = localStorage.getItem("access_token");
const socket = io("https://api-sadivacloset.himersus.com/realtime", { auth:{ token: `Bearer ${accessToken}` } });

socket.on("payment:confirmed", (data) => {
  document.querySelector("#badge").textContent = "PAGO ✓";
  fetch(`/api/v1/orders/${data.orderId}`, { headers:{ Authorization:`Bearer ${accessToken}` }})
    .then(r=>r.json()).then(console.log);
});

// Fallback se WebSocket desconectar: poll GET /orders/:id/payment a cada 3s por 2min
let poll = null;
function startPoll(orderId) {
  poll = setInterval(async () => {
    const r = await fetch(`https://api-sadivacloset.himersus.com/api/v1/orders/${orderId}/payment`, { headers:{ Authorization:`Bearer ${accessToken}` }});
    const j = await r.json();
    if (j.data?.status==="PAID") { clearInterval(poll); console.log("PAID via poll"); }
  }, 3000);
  setTimeout(()=>clearInterval(poll), 120000);
}
socket.on("disconnect", () => startPoll(orderId));
```

### 4.4 Admin Dashboard

```ts
// Admin ouve tudo
const adminSocket = io("https://api-sadivacloset.himersus.com/realtime", { auth:{ token:`Bearer ${adminAccessToken}` } });
adminSocket.on("payment:confirmed", (p) => console.log("[admin] pagamento", p.orderId, p.amount));
adminSocket.on("admin:newOrder", (o) => console.log("[admin] novo pedido", o.orderId));
adminSocket.on("notification:new", () => {}); // admins também recebem payment:confirmed
```

---

## 5. Fluxo completo — Checkout + WebSocket + Polling fallback

```ts
// 1. Checkout
const { data: order } = await api.post("/checkout", { type:"HOME_DELIVERY", scheduledDate:"2026-09-15", timeWindow:"09:00-12:00", addressId });
// 2. Conecta WS antes de iniciar pagamento
const socket = io(REALTIME_URL, { auth:{ token:`Bearer ${accessToken}` } });
let paid = false;
socket.on("payment:confirmed", (e) => {
  if (e.orderId===order.id) { paid=true; toast.success("Pagamento confirmado!"); navigate(`/orders/${order.id}`); }
});
// 3. Inicia pagamento GPO/GPR
await api.post(`/orders/${order.id}/payment/init`, { method:"gpo", phoneNumber:"923456789" });
// 4. Fallback polling caso WS caia
setTimeout(() => { if(!paid) startPoll(order.id); }, 5000);
// 5. Webhook Honor→Sadiva (AppyPay operationStatus:1)marca PAID e emite WS
```

---

## 6. Notificações — REST + WS (use ambos)

**REST (fonte da verdade, paginado):**
```
GET /profile/notifications  -> { data: Notification[] }  (isRead, createdAt desc)
PATCH /profile/notifications/:id/read  -> marca uma
PATCH /profile/notifications/read      -> marca todas { count }
```

**WS (tempo real, sem polling):**
- Ao criar notificação via `NotificationsService.criar` `notifications.service.ts:29`, o backend faz `realtimeGateway.emitNotification(buyerId, notification)` → `notification:new`.
- Frontend: `socket.on("notification:new", (e) => store.prepend(e.notification); setUnread(c=>c+1); toast(e.notification.title))`.
- Se WS desconectar, fallback: `GET /profile/notifications` ao focar aba (`window.addEventListener("focus", refetch)`).

---

## 7. Outros lugares com WebSocket

| Domínio | REST para buscar | WS evento | Quando emite |
|---------|------------------|-----------|--------------|
| **Pagamento** | `GET /orders/:id/payment` `GET /orders/:id` | `payment:confirmed`, `payment:failed` | Webhook `POST /webhooks/appypay` `operationStatus 1|3/4/5`, `POST /webhooks/payment/generic` `paid/failed`, `PATCH /admin/payments/:id/validar` |
| **Notificação** | `GET /profile/notifications` | `notification:new` | Toda `NotificationsService.criar` (pagamento confirmado, pedido validado, etc.) |
| **Pedido** | `GET /orders/:id`, `GET /profile/orders` | `order:statusUpdated` | `PATCH /admin/orders/:id/status` `AWAITING_PAYMENT→PAID→PREPARING→SHIPPING→COMPLETED` |
| **Entrega** | `delivery` dentro de `GET /orders/:id` | `delivery:statusUpdated` | `PATCH /admin/deliveries/:id/status` `SCHEDULED→ON_THE_WAY→DELIVERED` |
| **Admin** | `GET /admin/orders`, `GET /admin/statistics` | `admin:newOrder`, `payment:confirmed` (sala `admins`) | `POST /checkout` (novo pedido), qualquer `payment:confirmed` |

Todos caem em `buyer:${buyerId}` exceto `admin:newOrder` que é só `admins`.

---

## 8. Reconexão e Refresh Token

`access_token` expira em `15m` `src/config/configuration.ts:71`. Quando `api` fizer `POST /auth/refresh`, chame `socket.emit("auth:join", { token: "Bearer "+newAccessToken })` ou `socket.auth.token="Bearer "+newAccessToken; socket.disconnect().connect()`.

O gateway valida JWT com `JWT_SECRET` `realtime.gateway.ts:38` via `JwtService.verify`. Se falhar, `auth:join` retorna `{ ok:false, message:"Token inválido" }`.

---

## 9. Debug

*   `GET /orders/:id/payment/debug` (buyer) e `GET /admin/payments/:paymentId/debug` `src/modules/payments/debug-payments.controller.ts:13` mostram `webhookProcessedAt`, `redis` `webhook:payment:*`, `providerDetails.error`, `hints` para saber se falta `x-signature` ou proxy.
*   Logs: `RealtimeGateway` `Logger` `WS connected buyer:xxx`, `Emit payment:confirmed`.
*   Postman: pasta `DEBUG & WEBSOCKET (novo)` em `postman-collection.json` + `WEBSOCKET - Info`.

---

## 10. Checklist Frontend

- [ ] `pnpm add socket.io-client`
- [ ] `VITE_REALTIME_URL=https://api-sadivacloset.himersus.com/realtime` (`.env`)
- [ ] Hook `useRealtime(accessToken)` montado no `App.tsx` após login
- [ ] `socket.on("payment:confirmed")` → `invalidateQueries(["orders", orderId])` + toast + redirect
- [ ] `socket.on("notification:new")` → incrementa badge + prepend lista
- [ ] `socket.on("order:statusUpdated")` / `delivery:statusUpdated` → atualiza timeline
- [ ] Fallback polling `GET /orders/:id/payment` a cada 3s por 2min se `!paid` e `socket.disconnected`
- [ ] Ao `refresh_token`, chama `auth:join` com novo token
- [ ] Admin usa mesmo hook com `adminAccessToken` e ouve `admin:newOrder`

> **Swagger:** WebSocket não aparece em `https://api-sadivacloset.himersus.com/api/docs` (é Socket.IO, não REST). Use este `docs/WEBSOCKET.md` como contrato.
