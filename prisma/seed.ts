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

  // ── 2) Delivery zones — 16 Luanda neighborhoods ─────────
  const zones: { neighborhood: string; price: number }[] = [
    { neighborhood: 'Talatona', price: 2500 },
    { neighborhood: 'Kilamba', price: 3000 },
    { neighborhood: 'Viana', price: 2500 },
    { neighborhood: 'Cazenga', price: 2000 },
    { neighborhood: 'Maianga', price: 1500 },
    { neighborhood: 'Sambizanga', price: 1500 },
    { neighborhood: 'Ingombota', price: 1200 },
    { neighborhood: 'Rangel', price: 1500 },
    { neighborhood: 'Samba', price: 1800 },
    { neighborhood: 'Benfica', price: 2200 },
    { neighborhood: 'Cacuaco', price: 2800 },
    { neighborhood: 'Zango', price: 3200 },
    { neighborhood: 'Morro Bento', price: 2500 },
    { neighborhood: 'Alvalade', price: 1500 },
    { neighborhood: 'Miramar', price: 1200 },
    { neighborhood: 'Golf 2', price: 2000 },
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
  await prisma.storeConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      name: 'SadivaCloset',
      contactEmail: 'contacto@sadivacloset.co.ao',
      phone: '+244 900 000 000',
      address: 'Luanda, Talatona, Rua da Samba, nº 123',
    },
  });
  console.log('✅ StoreConfig singleton');

  // ── 4) AdminPreferences (singleton) ─────────────────────────
  await prisma.adminPreferences.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      notifyNewOrders: true,
      notifyLowStock: true,
      notifyNewMessages: true,
      defaultDeliveryFee: 2500,
      activePaymentMethods: [
        'MULTICAIXA_EXPRESS' as any,
        'MULTICAIXA_REFERENCE' as any,
        'CASH_ON_DELIVERY' as any,
      ],
    },
  });
  console.log('✅ AdminPreferences singleton');

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
