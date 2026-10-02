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

  await prisma.businessProfile.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      addressLine: 'Centro Comercial Omnium, Local 12',
      neighborhood: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      countryCode: 'CL',
      primaryCustomerProfile: 'Mujer 30-45 años en Las Condes que busca un cambio de look profesional, valora atención personalizada y disponibilidad de horarios.',
      commonObjections: ['No sé qué me queda bien', 'Tengo miedo de dañar mi cabello'],
      qualifyingQuestions: ['¿Qué te gustaría cambiar?', '¿Cuándo fue tu última coloración?', '¿Tienes alguna referencia de color o foto?'],
      brandVoiceKeywords: ['cercana', 'experta', 'luminosa', 'personalizada'],
      wordsToAvoid: ['descuento', 'garantizado', 'oferta'],
      preferredEmojiSemantics: ['✨', '🤍', '📍'],
      differentiators: ['Evaluación previa con estilista titulada', 'Colorimetría personalizada', 'Más de 8 años de experiencia'],
      tagline: 'Imagina tu color soñado',
      weeklyServiceCapacity: 25,
      monthlyRevenueTarget: 3500000,
      monthlyAcquisitionGoal: 12,
      costPerAcquisitionCap: 28000,
      nearbyCommunesCutCodes: [],
      profileCompletedAt: new Date(),
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

  const balayage = await prisma.service.findUnique({
    where: { businessId_name: { businessId: business.id, name: 'Balayage' } },
  });

  if (balayage) {
    const existingBrief = await prisma.campaignBrief.findFirst({
      where: {
        businessId: business.id,
        title: 'Balayage Q4 - evaluaciones',
      },
    });
    if (!existingBrief) {
      await prisma.campaignBrief.create({
        data: {
          businessId: business.id,
          serviceId: balayage.id,
          title: 'Balayage Q4 - evaluaciones',
          status: 'APPROVED',
          businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
          offer: 'Evaluación + 20% descuento en la primera sesión',
          primaryKpi: 'Evaluaciones',
          idealCustomerProfile:
            'Mujeres 30-45 que quieren un balayage natural sin dañar el cabello.',
          qualifyingQuestions: [
            '¿Tienes el cabello tinturado previamente?',
            '¿Buscas un look natural o más pronunciado?',
          ],
          constraints: ['No usar antes/después', 'Solo región Metropolitana'],
          stopIf: 'Si no hay 5 contactos calificados en 14 días',
          scaleIf: 'Si CPL < $5.000 con >10 conversaciones',
          monthlyAcquisitionGoal: 20,
          costPerAcquisitionCap: 5000,
          lifetimeBudgetCap: 200_000,
          dailyBudgetCap: 25_000,
          plannedDurationDays: 14,
          approvedAt: new Date(),
        },
      });
    }
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
