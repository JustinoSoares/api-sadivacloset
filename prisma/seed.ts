import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed iniciado...');

  // ── 1) Admin ────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.comprador.upsert({
    where: { email: 'admin@sadivacloset.local' },
    update: {
      nome: 'Admin SadivaCloset',
      role: 'admin',
      ativo: true,
      passwordHash,
    },
    create: {
      nome: 'Admin SadivaCloset',
      email: 'admin@sadivacloset.local',
      passwordHash,
      role: 'admin',
      ativo: true,
    },
  });
  console.log(`✅ Admin: ${admin.email} (${admin.id}) role=${admin.role}`);

  // ── 2) Zonas de entrega — 16 bairros reais de Luanda ─────────
  const zonas: { bairro: string; preco: number }[] = [
    { bairro: 'Talatona', preco: 2500 },
    { bairro: 'Kilamba', preco: 3000 },
    { bairro: 'Viana', preco: 2500 },
    { bairro: 'Cazenga', preco: 2000 },
    { bairro: 'Maianga', preco: 1500 },
    { bairro: 'Sambizanga', preco: 1500 },
    { bairro: 'Ingombota', preco: 1200 },
    { bairro: 'Rangel', preco: 1500 },
    { bairro: 'Samba', preco: 1800 },
    { bairro: 'Benfica', preco: 2200 },
    { bairro: 'Cacuaco', preco: 2800 },
    { bairro: 'Zango', preco: 3200 },
    { bairro: 'Morro Bento', preco: 2500 },
    { bairro: 'Alvalade', preco: 1500 },
    { bairro: 'Miramar', preco: 1200 },
    { bairro: 'Golf 2', preco: 2000 },
  ];

  for (const z of zonas) {
    await prisma.zonaEntrega.upsert({
      where: { bairro: z.bairro },
      update: { preco: z.preco },
      create: { bairro: z.bairro, preco: z.preco },
    });
  }
  console.log(`✅ Zonas: ${zonas.length} bairros`);

  // ── 3) LojaConfig (singleton) ─────────────────────────────────
  await prisma.lojaConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      nome: 'SadivaCloset',
      emailContacto: 'contacto@sadivacloset.co.ao',
      telefone: '+244 900 000 000',
      morada: 'Luanda, Talatona, Rua da Samba, nº 123',
    },
  });
  console.log('✅ LojaConfig singleton');

  // ── 4) PreferenciasAdmin (singleton) ─────────────────────────
  await prisma.preferenciasAdmin.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      notificarNovosPedidos: true,
      notificarStockBaixo: true,
      notificarNovasMensagens: true,
      taxaEntregaPadrao: 2500,
      metodosPagamentoAtivos: [
        'multicaixa_express',
        'referencia_multicaixa',
        'pagamento_entrega',
      ],
    },
  });
  console.log('✅ PreferenciasAdmin singleton');

  // ── 5) Produtos de exemplo — 3-4 categorias ──────────────────
  const produtosCount = await prisma.produto.count();
  if (produtosCount === 0) {
    const produtos = [
      {
        imagem: 'https://picsum.photos/seed/fato-preto/600/800',
        nomeProduto: 'Fato Social Preto Clássico',
        descricao:
          'Fato completo (paletó + calça) em tecido premium, corte moderno, ideal para cerimónias e trabalho.',
        categoria: 'fatos' as const,
        tamanho: 'M',
        estado: 'novo' as const,
        volume: 10,
        price: 45000,
        desconto: 10,
      },
      {
        imagem: 'https://picsum.photos/seed/camisa-branca/600/800',
        nomeProduto: 'Camisa Branca Clássica',
        descricao:
          'Camisa de algodão 100%, gola italiana, manga comprida — semi-nova em excelente estado.',
        categoria: 'camisas' as const,
        tamanho: 'L',
        estado: 'semi_novo' as const,
        volume: 15,
        price: 15000,
        desconto: 0,
      },
      {
        imagem: 'https://picsum.photos/seed/vestido-floral/600/800',
        nomeProduto: 'Vestido Floral Verão',
        descricao:
          'Vestido leve estampado floral, tecido fluido, perfeito para dias quentes.',
        categoria: 'vestidos' as const,
        tamanho: 'S',
        estado: 'novo' as const,
        volume: 8,
        price: 25000,
        desconto: 15,
      },
      {
        imagem: 'https://picsum.photos/seed/conjunto-casual/600/800',
        nomeProduto: 'Conjunto Casual Unissexo',
        descricao:
          'Conjunto descontraído (camisola + calção) — categoria outros, ideal para dia a dia.',
        categoria: 'outros' as const,
        tamanho: 'M',
        estado: 'novo' as const,
        volume: 20,
        price: 18000,
        desconto: 5,
      },
    ];

    for (const p of produtos) {
      await prisma.produto.create({ data: p });
    }
    console.log(`✅ Produtos: ${produtos.length} criados`);
  } else {
    console.log(`ℹ️ Produtos já existem (${produtosCount}), skip`);
  }

  // ── Resumo ───────────────────────────────────────────────────
  const [totalCompradores, totalZonas, totalProdutos] = await Promise.all([
    prisma.comprador.count(),
    prisma.zonaEntrega.count(),
    prisma.produto.count(),
  ]);
  console.log(
    `🎉 Seed concluído — compradores=${totalCompradores} zonas=${totalZonas} produtos=${totalProdutos}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
