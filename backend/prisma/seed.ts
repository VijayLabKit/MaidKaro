import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MaidKaro launch data (Siliguri)...');

  const siliguri = await prisma.city.upsert({
    where: { name: 'Siliguri' },
    update: {},
    create: { name: 'Siliguri', state: 'West Bengal' },
  });

  const zones = await Promise.all(
    ['Sevoke Road', 'Hill Cart Road', 'Matigara', 'Salugara'].map((name) =>
      prisma.serviceZone.upsert({
        where: { id: `${siliguri.id}-${name}` }, // deterministic-ish; fine for a seed script
        update: {},
        create: { id: `${siliguri.id}-${name}`.slice(0, 36), cityId: siliguri.id, name: `Siliguri - ${name}` },
      }).catch(() =>
        prisma.serviceZone.create({ data: { cityId: siliguri.id, name: `Siliguri - ${name}` } }),
      ),
    ),
  );

  const pincodeMap: Record<string, string[]> = {
    'Sevoke Road': ['734001', '734005'],
    'Hill Cart Road': ['734001', '734002'],
    Matigara: ['734010'],
    Salugara: ['734008'],
  };

  for (const zone of zones) {
    const zoneNameKey = zone.name.replace('Siliguri - ', '');
    for (const code of pincodeMap[zoneNameKey] ?? []) {
      await prisma.pincode.upsert({ where: { code }, update: {}, create: { code, serviceZoneId: zone.id } });
    }
  }

  const categories = [
    { name: 'Kitchen Help', slug: 'kitchen-help', description: 'Daily cooking assistance for your household.', baseHourlyRate: 150 },
    { name: 'Home Cleaning', slug: 'home-cleaning', description: 'Room and full-home deep or routine cleaning.', baseHourlyRate: 130 },
    { name: 'Babysitting', slug: 'babysitting', description: 'Trusted, verified care for your children.', baseHourlyRate: 180 },
    { name: 'Elder Care', slug: 'elder-care', description: 'Compassionate day-to-day support for elderly family members.', baseHourlyRate: 200 },
    { name: 'Nursing Support', slug: 'nursing-support', description: 'Trained nursing assistance for post-op or chronic care.', baseHourlyRate: 250 },
  ];

  for (const [i, c] of categories.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, sortOrder: i, commissionPct: 15 },
    });
    await prisma.cityCategory.upsert({
      where: { cityId_categoryId: { cityId: siliguri.id, categoryId: category.id } },
      update: { isActive: true },
      create: { cityId: siliguri.id, categoryId: category.id, isActive: true },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      phone: '+919999999999',
      role: 'SUPER_ADMIN',
      adminProfile: {
        create: {
          fullName: 'Vijay Ishan',
          email: 'admin@maidkaro.in',
          passwordHash: await bcrypt.hash('ChangeMe123!', 10),
        },
      },
    },
  });

  console.log('Seed complete:', { city: siliguri.name, zones: zones.length, categories: categories.length, admin: adminUser.phone });
  console.log('Default admin login -> email: admin@maidkaro.in / password: ChangeMe123!  (change this immediately)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
