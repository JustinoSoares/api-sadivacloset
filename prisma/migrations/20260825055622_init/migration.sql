-- CreateEnum
CREATE TYPE "Role" AS ENUM ('comprador', 'admin');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('fatos', 'camisas', 'vestidos', 'outros');

-- CreateEnum
CREATE TYPE "EstadoProduto" AS ENUM ('novo', 'semi_novo');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('aguardando_pagamento', 'pago', 'em_preparacao', 'em_entrega', 'concluido', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('domicilio', 'levantamento_loja');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('agendada', 'a_caminho', 'entregue', 'falhada', 'cancelada');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('multicaixa_express', 'referencia_multicaixa', 'transferencia', 'pagamento_entrega', 'cartao');

-- CreateEnum
CREATE TYPE "EstadoPagamento" AS ENUM ('pendente', 'processando', 'pago', 'falhado', 'reembolsado');

-- CreateTable
CREATE TABLE "compradores" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'comprador',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "compradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL,
    "imagem" TEXT NOT NULL,
    "nome_produto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "tamanho" TEXT NOT NULL,
    "estado" "EstadoProduto" NOT NULL,
    "volume" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "desconto" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas_entrega" (
    "id" UUID NOT NULL,
    "bairro" TEXT NOT NULL,
    "preco" INTEGER NOT NULL,

    CONSTRAINT "zonas_entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favoritos" (
    "comprador_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favoritos_pkey" PRIMARY KEY ("comprador_id","produto_id")
);

-- CreateTable
CREATE TABLE "itens_carrinho" (
    "id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "itens_carrinho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "rua" TEXT NOT NULL,
    "referencia" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "predefinida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxa_entrega" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'aguardando_pagamento',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "nome_produto" TEXT NOT NULL,
    "preco_unitario" INTEGER NOT NULL,
    "desconto" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas_pedido" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "tipo" "TipoEntrega" NOT NULL,
    "endereco_id" UUID,
    "data_agendada" DATE NOT NULL,
    "janela_horario" TEXT NOT NULL,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'agendada',
    "taxa_entrega" INTEGER NOT NULL,
    "instrucoes" TEXT,

    CONSTRAINT "entregas_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "valor" INTEGER NOT NULL,
    "estado" "EstadoPagamento" NOT NULL DEFAULT 'pendente',
    "referencia_externa" TEXT,
    "comprovativo_url" TEXT,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loja_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nome" TEXT NOT NULL DEFAULT 'SadivaCloset',
    "email_contacto" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "morada" TEXT NOT NULL,

    CONSTRAINT "loja_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencias_admin" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "notificar_novos_pedidos" BOOLEAN NOT NULL DEFAULT true,
    "notificar_stock_baixo" BOOLEAN NOT NULL DEFAULT true,
    "notificar_novas_mensagens" BOOLEAN NOT NULL DEFAULT true,
    "taxa_entrega_padrao" INTEGER NOT NULL DEFAULT 3000,
    "metodos_pagamento_ativos" "MetodoPagamento"[],

    CONSTRAINT "preferencias_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "detalhes" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compradores_email_key" ON "compradores"("email");

-- CreateIndex
CREATE INDEX "produtos_categoria_idx" ON "produtos"("categoria");

-- CreateIndex
CREATE INDEX "produtos_estado_idx" ON "produtos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_entrega_bairro_key" ON "zonas_entrega"("bairro");

-- CreateIndex
CREATE UNIQUE INDEX "itens_carrinho_comprador_id_produto_id_key" ON "itens_carrinho"("comprador_id", "produto_id");

-- CreateIndex
CREATE INDEX "notificacoes_comprador_id_lida_idx" ON "notificacoes"("comprador_id", "lida");

-- CreateIndex
CREATE INDEX "enderecos_comprador_id_idx" ON "enderecos"("comprador_id");

-- CreateIndex
CREATE INDEX "pedidos_comprador_id_estado_idx" ON "pedidos"("comprador_id", "estado");

-- CreateIndex
CREATE INDEX "itens_pedido_pedido_id_idx" ON "itens_pedido"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_pedido_pedido_id_key" ON "entregas_pedido"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_pedido_id_key" ON "pagamentos"("pedido_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_admin_id_idx" ON "logs_auditoria"("admin_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidade_id_idx" ON "logs_auditoria"("entidade", "entidade_id");

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_carrinho" ADD CONSTRAINT "itens_carrinho_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_carrinho" ADD CONSTRAINT "itens_carrinho_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_pedido" ADD CONSTRAINT "entregas_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas_pedido" ADD CONSTRAINT "entregas_pedido_endereco_id_fkey" FOREIGN KEY ("endereco_id") REFERENCES "enderecos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "compradores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
