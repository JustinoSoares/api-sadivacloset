-- Migration: rename all tables/columns/enums from Portuguese to English
-- Keeps data, preserves Portuguese enum values via @map, only renames identifiers
-- All user-facing messages remain in Portuguese, only DB identifiers change to English

-- ── Rename enum types (Role already English) ───────────────────────────────
ALTER TYPE "Categoria" RENAME TO "Category";
ALTER TYPE "EstadoProduto" RENAME TO "ProductCondition";
ALTER TYPE "EstadoPedido" RENAME TO "OrderStatus";
ALTER TYPE "TipoEntrega" RENAME TO "DeliveryType";
ALTER TYPE "EstadoEntrega" RENAME TO "DeliveryStatus";
ALTER TYPE "MetodoPagamento" RENAME TO "PaymentMethod";
ALTER TYPE "EstadoPagamento" RENAME TO "PaymentStatus";

-- ── Rename tables ──────────────────────────────────────────────────────────
ALTER TABLE "compradores" RENAME TO "users";
ALTER TABLE "produtos" RENAME TO "products";
ALTER TABLE "zonas_entrega" RENAME TO "delivery_zones";
ALTER TABLE "favoritos" RENAME TO "favorites";
ALTER TABLE "itens_carrinho" RENAME TO "cart_items";
ALTER TABLE "notificacoes" RENAME TO "notifications";
ALTER TABLE "enderecos" RENAME TO "addresses";
ALTER TABLE "pedidos" RENAME TO "orders";
ALTER TABLE "itens_pedido" RENAME TO "order_items";
ALTER TABLE "entregas_pedido" RENAME TO "deliveries";
ALTER TABLE "pagamentos" RENAME TO "payments";
ALTER TABLE "loja_config" RENAME TO "store_configs";
ALTER TABLE "preferencias_admin" RENAME TO "admin_preferences";
ALTER TABLE "logs_auditoria" RENAME TO "audit_logs";

-- ── users ─────────────────────────────────────────────────────────────────
ALTER TABLE "users" RENAME COLUMN "nome" TO "name";
ALTER TABLE "users" RENAME COLUMN "criado_em" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "ativo" TO "is_active";
-- password_hash, email, id, role keep same (password_hash is already English snake_case)

-- ── products ───────────────────────────────────────────────────────────────
ALTER TABLE "products" RENAME COLUMN "imagem" TO "image";
ALTER TABLE "products" RENAME COLUMN "nome_produto" TO "name";
ALTER TABLE "products" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "products" RENAME COLUMN "categoria" TO "category";
ALTER TABLE "products" RENAME COLUMN "tamanho" TO "size";
ALTER TABLE "products" RENAME COLUMN "estado" TO "condition";
ALTER TABLE "products" RENAME COLUMN "volume" TO "stock";
ALTER TABLE "products" RENAME COLUMN "desconto" TO "discount";
ALTER TABLE "products" RENAME COLUMN "criado_em" TO "created_at";

-- ── delivery_zones ─────────────────────────────────────────────────────────
ALTER TABLE "delivery_zones" RENAME COLUMN "bairro" TO "neighborhood";
ALTER TABLE "delivery_zones" RENAME COLUMN "preco" TO "price";

-- ── favorites ──────────────────────────────────────────────────────────────
ALTER TABLE "favorites" RENAME COLUMN "comprador_id" TO "buyer_id";
ALTER TABLE "favorites" RENAME COLUMN "produto_id" TO "product_id";
ALTER TABLE "favorites" RENAME COLUMN "criado_em" TO "created_at";

-- ── cart_items ─────────────────────────────────────────────────────────────
ALTER TABLE "cart_items" RENAME COLUMN "comprador_id" TO "buyer_id";
ALTER TABLE "cart_items" RENAME COLUMN "produto_id" TO "product_id";
ALTER TABLE "cart_items" RENAME COLUMN "quantidade" TO "quantity";

-- ── notifications ──────────────────────────────────────────────────────────
ALTER TABLE "notifications" RENAME COLUMN "comprador_id" TO "buyer_id";
ALTER TABLE "notifications" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "notifications" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "notifications" RENAME COLUMN "criado_em" TO "created_at";
ALTER TABLE "notifications" RENAME COLUMN "lida" TO "is_read";

-- ── addresses ──────────────────────────────────────────────────────────────
ALTER TABLE "addresses" RENAME COLUMN "comprador_id" TO "buyer_id";
ALTER TABLE "addresses" RENAME COLUMN "etiqueta" TO "label";
ALTER TABLE "addresses" RENAME COLUMN "provincia" TO "province";
ALTER TABLE "addresses" RENAME COLUMN "municipio" TO "municipality";
ALTER TABLE "addresses" RENAME COLUMN "bairro" TO "neighborhood";
ALTER TABLE "addresses" RENAME COLUMN "rua" TO "street";
-- referencia stays
ALTER TABLE "addresses" RENAME COLUMN "predefinida" TO "is_default";

-- ── orders ─────────────────────────────────────────────────────────────────
ALTER TABLE "orders" RENAME COLUMN "comprador_id" TO "buyer_id";
ALTER TABLE "orders" RENAME COLUMN "taxa_entrega" TO "delivery_fee";
ALTER TABLE "orders" RENAME COLUMN "estado" TO "status";
ALTER TABLE "orders" RENAME COLUMN "criado_em" TO "created_at";

-- ── order_items ────────────────────────────────────────────────────────────
ALTER TABLE "order_items" RENAME COLUMN "pedido_id" TO "order_id";
ALTER TABLE "order_items" RENAME COLUMN "produto_id" TO "product_id";
ALTER TABLE "order_items" RENAME COLUMN "nome_produto" TO "product_name";
ALTER TABLE "order_items" RENAME COLUMN "preco_unitario" TO "unit_price";
ALTER TABLE "order_items" RENAME COLUMN "quantidade" TO "quantity";
-- desconto stays

-- ── deliveries ─────────────────────────────────────────────────────────────
ALTER TABLE "deliveries" RENAME COLUMN "pedido_id" TO "order_id";
ALTER TABLE "deliveries" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "deliveries" RENAME COLUMN "endereco_id" TO "address_id";
ALTER TABLE "deliveries" RENAME COLUMN "data_agendada" TO "scheduled_date";
ALTER TABLE "deliveries" RENAME COLUMN "janela_horario" TO "time_window";
ALTER TABLE "deliveries" RENAME COLUMN "estado" TO "status";
ALTER TABLE "deliveries" RENAME COLUMN "taxa_entrega" TO "delivery_fee";
ALTER TABLE "deliveries" RENAME COLUMN "instrucoes" TO "instructions";

-- ── payments ───────────────────────────────────────────────────────────────
ALTER TABLE "payments" RENAME COLUMN "pedido_id" TO "order_id";
ALTER TABLE "payments" RENAME COLUMN "metodo" TO "method";
ALTER TABLE "payments" RENAME COLUMN "valor" TO "amount";
ALTER TABLE "payments" RENAME COLUMN "estado" TO "status";
ALTER TABLE "payments" RENAME COLUMN "referencia_externa" TO "external_reference";
ALTER TABLE "payments" RENAME COLUMN "comprovativo_url" TO "receipt_url";

-- Add new columns that did not exist in initial migration (nullable for existing rows)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_tx_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bridpay_intent_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bridpay_merchant_tx_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider_details" JSONB;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "webhook_processed_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- migrate existing criado_em data if column still exists under old name? Already renamed to created_at above – but initial table had no created_at, only pagamentos had no criado_em/updated_at? Actually initial pagamentos had no created_at; we add it now. Keep default.
-- If pagamentos had criado_em from later manual addition, ensure renamed: try to rename if exists (idempotent via DO block)

-- ── store_configs ──────────────────────────────────────────────────────────
ALTER TABLE "store_configs" RENAME COLUMN "nome" TO "name";
ALTER TABLE "store_configs" RENAME COLUMN "email_contacto" TO "contact_email";
ALTER TABLE "store_configs" RENAME COLUMN "telefone" TO "phone";
ALTER TABLE "store_configs" RENAME COLUMN "morada" TO "address";

-- ── admin_preferences ──────────────────────────────────────────────────────
ALTER TABLE "admin_preferences" RENAME COLUMN "notificar_novos_pedidos" TO "notify_new_orders";
ALTER TABLE "admin_preferences" RENAME COLUMN "notificar_stock_baixo" TO "notify_low_stock";
ALTER TABLE "admin_preferences" RENAME COLUMN "notificar_novas_mensagens" TO "notify_new_messages";
ALTER TABLE "admin_preferences" RENAME COLUMN "taxa_entrega_padrao" TO "default_delivery_fee";
ALTER TABLE "admin_preferences" RENAME COLUMN "metodos_pagamento_ativos" TO "active_payment_methods";

-- ── audit_logs ─────────────────────────────────────────────────────────────
ALTER TABLE "audit_logs" RENAME COLUMN "acao" TO "action";
ALTER TABLE "audit_logs" RENAME COLUMN "entidade" TO "entity";
ALTER TABLE "audit_logs" RENAME COLUMN "entidade_id" TO "entity_id";
ALTER TABLE "audit_logs" RENAME COLUMN "detalhes" TO "details";
ALTER TABLE "audit_logs" RENAME COLUMN "criado_em" TO "created_at";

-- ── Create new tables that did not exist in initial migration ─────────────
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL DEFAULT 0,
    "balance_after" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'settled',
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "payment_id" UUID,
    "bridpay_tx_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payouts" (
    "id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "iban" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'transferencia',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pendente',
    "external_reference" TEXT,
    "provider_tx_id" TEXT,
    "description" TEXT,
    "order_id" UUID,
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- ── Recreate indexes with English column names (old indexes will be renamed automatically with table, but column indexes need recreate if column renamed) ─────
-- For simplicity, drop and recreate indexes that reference renamed columns

DROP INDEX IF EXISTS "produtos_categoria_idx";
DROP INDEX IF EXISTS "produtos_estado_idx";
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products"("category");
CREATE INDEX IF NOT EXISTS "products_condition_idx" ON "products"("condition");

DROP INDEX IF EXISTS "notificacoes_comprador_id_lida_idx";
CREATE INDEX IF NOT EXISTS "notifications_buyer_id_is_read_idx" ON "notifications"("buyer_id", "is_read");

DROP INDEX IF EXISTS "enderecos_comprador_id_idx";
CREATE INDEX IF NOT EXISTS "addresses_buyer_id_idx" ON "addresses"("buyer_id");

DROP INDEX IF EXISTS "pedidos_comprador_id_estado_idx";
CREATE INDEX IF NOT EXISTS "orders_buyer_id_status_idx" ON "orders"("buyer_id", "status");

DROP INDEX IF EXISTS "itens_pedido_pedido_id_idx";
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");

DROP INDEX IF EXISTS "logs_auditoria_admin_id_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_admin_id_idx" ON "audit_logs"("admin_id");

DROP INDEX IF EXISTS "logs_auditoria_entidade_entidade_id_idx";
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- wallet_transactions indexes
CREATE INDEX IF NOT EXISTS "wallet_transactions_type_idx" ON "wallet_transactions"("type");
CREATE INDEX IF NOT EXISTS "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");
