import { PrismaClient } from '@prisma/client';
import { loadRootEnv } from '../dist/env';

loadRootEnv();

const prisma = new PrismaClient();

function resolveBusinessId(): string {
  const raw = process.env.BUSINESS_ID;
  if (!raw || raw.trim().length === 0) {
    throw new Error('BUSINESS_ID debe estar definido y no vacío para ejecutar el seed.');
  }
  return raw.trim();
}

async function main() {
  const businessId = resolveBusinessId();

  const business = await prisma.business.upsert({
    where: { id: businessId },
    update: {},
    create: {
      id: businessId,
      name: 'Blondor',
      description: 'Peluquería Blondor',
      location: 'Chile',
      socialLinks: {
        instagram: 'https://instagram.com/blondor',
      },
      settings: {
        currency: 'CLP',
      },
    },
  });

  const services = [
    { name: 'Balayage', price: 95500, duration: 120, description: 'Mechas balayage' },
    { name: 'Corte', price: 18000, duration: 45, description: 'Corte de cabello' },
    { name: 'Color', price: 65000, duration: 90, description: 'Coloración completa' },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: { businessId_name: { businessId: business.id, name: svc.name } },
      update: {},
      create: {
        businessId: business.id,
        ...svc,
        currency: 'CLP',
      },
    });
  }

  console.log(`Seed completado para negocio ${business.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
