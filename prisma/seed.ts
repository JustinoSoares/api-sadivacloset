import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed started...');

  // ── 1) Admin ────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sadivacloset.local' },
    update: {
      name: 'Admin SadivaCloset',
      role: 'ADMIN' as any,
      isActive: true,
      passwordHash,
    },
    create: {
      name: 'Admin SadivaCloset',
      email: 'admin@sadivacloset.local',
      passwordHash,
      role: 'ADMIN' as any,
      isActive: true,
    },
  });
  console.log(`✅ Admin: ${admin.email} (${admin.id}) role=${admin.role}`);

  // ── 2) Delivery zones — 32 pontos mais conhecidos de Luanda ─────────
  // Centro (1200-1800) < Intermediário (2000-2500) < Periférico (2800-3500) — preços em Kz
  const zones: { neighborhood: string; price: number }[] = [
    // Centro / Baixa — mais barato (próximo ao centro logístico Talatona/Ingombota)
    { neighborhood: 'Ingombota', price: 1200 },
    { neighborhood: 'Miramar', price: 1200 },
    { neighborhood: 'Ilha de Luanda', price: 1500 },
    { neighborhood: 'Maianga', price: 1500 },
    { neighborhood: 'Alvalade', price: 1500 },
    { neighborhood: 'Sambizanga', price: 1500 },
    { neighborhood: 'Rangel', price: 1500 },
    { neighborhood: 'Samba', price: 1800 },
    { neighborhood: 'Mutamba', price: 1200 },
    { neighborhood: 'Kinaxixe', price: 1300 },
    // Intermediário — anel urbano
    { neighborhood: 'Talatona', price: 2200 },
    { neighborhood: 'Morro Bento', price: 2200 },
    { neighborhood: 'Benfica', price: 2200 },
    { neighborhood: 'Golf 2', price: 2000 },
    { neighborhood: 'Golf 1', price: 2000 },
    { neighborhood: 'Kilamba Kiaxi', price: 2000 },
    { neighborhood: 'Cazenga', price: 2000 },
    { neighborhood: 'Hoji-ya-Henda', price: 2000 },
    { neighborhood: 'Palanca', price: 2200 },
    { neighborhood: 'Prenda', price: 1800 },
    { neighborhood: 'Cassenda', price: 1800 },
    { neighborhood: 'Futungo', price: 2500 },
    { neighborhood: 'Camama', price: 2300 },
    // Periférico / Expansão — mais caro
    { neighborhood: 'Kilamba', price: 3000 },
    { neighborhood: 'Viana', price: 2800 },
    { neighborhood: 'Zango', price: 3200 },
    { neighborhood: 'Sequele', price: 3000 },
    { neighborhood: 'Cacuaco', price: 3000 },
    { neighborhood: 'Calemba 2', price: 2500 },
    { neighborhood: 'Sapú', price: 2800 },
    { neighborhood: 'Belas', price: 3200 },
    { neighborhood: 'Barra do Kwanza', price: 3500 },
  ];

  for (const z of zones) {
    await prisma.deliveryZone.upsert({
      where: { neighborhood: z.neighborhood },
      update: { price: z.price },
      create: { neighborhood: z.neighborhood, price: z.price },
    });
  }
  console.log(`✅ Zones: ${zones.length} neighborhoods`);

  // ── 3) StoreConfig (singleton) ─────────────────────────────────
  // Seed completo loja + notificações admin — nome, email, telefone, endereço
  const storeData = {
    name: 'SadivaCloset',
    contactEmail: 'contacto@sadivacloset.co.ao',
    phone: '+244 923 456 789',
    address: 'Luanda, Talatona, Condomínio Rosalinda, Rua da Samba, nº 123 - Loja 5 | Horário: Seg-Sab 08:00-18:00',
  };
  await prisma.storeConfig.upsert({
    where: { id: 'singleton' },
    update: storeData,
    create: { id: 'singleton', ...storeData },
  });
  console.log(`✅ StoreConfig singleton — ${storeData.name} ${storeData.contactEmail} ${storeData.phone}`);

  // ── 4) AdminPreferences (singleton) ─────────────────────────
  // Configurações de notificações admin + taxa entrega + métodos ativos
  const prefsData = {
    notifyNewOrders: true,
    notifyLowStock: true,
    notifyNewMessages: true,
    defaultDeliveryFee: 2500,
    activePaymentMethods: [
      'MULTICAIXA_EXPRESS' as any,
      'MULTICAIXA_REFERENCE' as any,
      'BANK_TRANSFER' as any,
      'CASH_ON_DELIVERY' as any,
    ],
  };
  await prisma.adminPreferences.upsert({
    where: { id: 'singleton' },
    update: prefsData,
    create: { id: 'singleton', ...prefsData },
  });
  console.log(`✅ AdminPreferences singleton — notifyNewOrders=${prefsData.notifyNewOrders} fee=${prefsData.defaultDeliveryFee} methods=${prefsData.activePaymentMethods.join(',')}`);

  // ── 5) Example products — 3-4 categories ──────────────────
  const productsCount = await prisma.product.count();
  if (productsCount === 0) {
    const products = [
      {
        image: 'https://picsum.photos/seed/fato-preto/600/800',
        name: 'Classic Black Suit',
        description: 'Complete suit (blazer + pants) in premium fabric, modern cut, ideal for ceremonies and work.',
        category: 'SUITS' as any,
        size: 'M',
        condition: 'NEW' as any,
        stock: 10,
        price: 45000,
        discount: 10,
      },
      {
        image: 'https://picsum.photos/seed/camisa-branca/600/800',
        name: 'Classic White Shirt',
        description: '100% cotton shirt, Italian collar, long sleeves — pre-owned in excellent condition.',
        category: 'SHIRTS' as any,
        size: 'L',
        condition: 'PRE_OWNED' as any,
        stock: 15,
        price: 15000,
        discount: 0,
      },
      {
        image: 'https://picsum.photos/seed/vestido-floral/600/800',
        name: 'Floral Summer Dress',
        description: 'Light floral printed dress, fluid fabric, perfect for hot days.',
        category: 'DRESSES' as any,
        size: 'S',
        condition: 'NEW' as any,
        stock: 8,
        price: 25000,
        discount: 15,
      },
      {
        image: 'https://picsum.photos/seed/conjunto-casual/600/800',
        name: 'Unisex Casual Set',
        description: 'Relaxed set (sweater + shorts) — category others, ideal for daily use.',
        category: 'OTHERS' as any,
        size: 'M',
        condition: 'NEW' as any,
        stock: 20,
        price: 18000,
        discount: 5,
      },
    ];

    for (const p of products) {
      await prisma.product.create({ data: p });
    }
    console.log(`✅ Products: ${products.length} created`);
  } else {
    console.log(`ℹ️ Products already exist (${productsCount}), skip`);
  }

  // ── Summary ───────────────────────────────────────────────────
  const [totalUsers, totalZones, totalProducts] = await Promise.all([
    prisma.user.count(),
    prisma.deliveryZone.count(),
    prisma.product.count(),
  ]);
  console.log(`🎉 Seed completed — users=${totalUsers} zones=${totalZones} products=${totalProducts}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
