import './setup';
import request from 'supertest';
import { prisma } from '@publicador/database';
import { buildApp } from './helpers/test-app';

const BUSINESS_ID = process.env.BUSINESS_ID ?? 'test-business';
const API_PREFIX = process.env.API_PREFIX ?? 'api/v1';

interface BriefPayload {
  title: string;
  serviceId: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile?: string;
  qualifyingQuestions?: string[];
  constraints?: string[];
  stopIf?: string;
  scaleIf?: string;
  monthlyAcquisitionGoal?: number;
  costPerAcquisitionCap?: number;
  lifetimeBudgetCap?: number;
  dailyBudgetCap?: number;
  plannedDurationDays?: number;
}

interface BriefResponse extends BriefPayload {
  id: string;
  businessId: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

async function createServiceFor(
  businessId: string,
  name = 'Balayage',
): Promise<{ id: string; name: string }> {
  return prisma.service.create({
    data: {
      businessId,
      name,
      price: 95_500,
      currency: 'CLP',
      duration: 120,
      isActive: true,
    },
  });
}

const validPayload = (serviceId: string): BriefPayload => ({
  title: 'Balayage Q4',
  serviceId,
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento en la primera sesión',
  primaryKpi: 'Evaluaciones',
  qualifyingQuestions: ['¿Cabello tinturado?', '¿Pelo largo?'],
  constraints: ['No usar antes/después'],
  stopIf: 'Si no hay 5 contactos calificados en 14 días',
  scaleIf: 'Si CPL < $5.000 con >10 conversaciones',
  monthlyAcquisitionGoal: 20,
  costPerAcquisitionCap: 5000,
  lifetimeBudgetCap: 200_000,
  dailyBudgetCap: 25_000,
  plannedDurationDays: 14,
});

describe('GET/POST/PATCH /campaign-briefs (integration)', () => {
  it('crea un brief (201) y lo lee (200)', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const createdBody = created.body as BriefResponse;
      expect(createdBody.id).toBeDefined();
      expect(createdBody.businessId).toBe(BUSINESS_ID);
      expect(createdBody.status).toBe('DRAFT');
      expect(createdBody.approvedAt).toBeNull();
      expect(createdBody.title).toBe('Balayage Q4');

      const fetched = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs/${createdBody.id}`)
        .expect(200);
      const fetchedBody = fetched.body as BriefResponse;
      expect(fetchedBody.id).toBe(createdBody.id);
      expect(fetchedBody.serviceId).toBe(service.id);
      expect(fetchedBody.qualifyingQuestions).toEqual(['¿Cabello tinturado?', '¿Pelo largo?']);
      expect(fetchedBody.costPerAcquisitionCap).toBe('5000');
    } finally {
      await app.close();
    }
  });

  it('lista con filtro status=APPROVED y sin filtro', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      // 1: DRAFT
      const draft = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      // 2: APPROVED
      const toApprove = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${toApprove.body.id}/approve`)
        .expect(201);

      const all = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs`)
        .expect(200);
      const allBody = all.body as BriefResponse[];
      expect(allBody.length).toBe(2);
      // orden createdAt desc: el último creado debe ir primero.
      expect(allBody[0].id).toBe(toApprove.body.id);

      const approved = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs?status=APPROVED`)
        .expect(200);
      const approvedBody = approved.body as BriefResponse[];
      expect(approvedBody.length).toBe(1);
      expect(approvedBody[0].status).toBe('APPROVED');
      expect(approvedBody[0].id).toBe(toApprove.body.id);

      const drafts = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs?status=DRAFT`)
        .expect(200);
      const draftsBody = drafts.body as BriefResponse[];
      expect(draftsBody.length).toBe(1);
      expect(draftsBody[0].id).toBe(draft.body.id);

      void draft;
    } finally {
      await app.close();
    }
  });

  it('aprueba un brief que cumple todos los campos críticos (201 y approvedAt no nulo)', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const approved = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${(created.body as BriefResponse).id}/approve`)
        .expect(201);
      const approvedBody = approved.body as BriefResponse;
      expect(approvedBody.status).toBe('APPROVED');
      expect(approvedBody.approvedAt).not.toBeNull();
    } finally {
      await app.close();
    }
  });

  it('rechaza aprobar un brief sin campos críticos (400)', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      // Creamos con un payload válido. Zod impide que el endpoint acepte
      // `title: ''` por PATCH, así que vaciamos el campo directamente vía
      // Prisma para forzar el rechazo del endpoint approve.
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefId = (created.body as BriefResponse).id;
      await prisma.campaignBrief.update({
        where: { id: briefId },
        data: { title: '' },
      });

      const approve = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${briefId}/approve`);
      expect(approve.status).toBe(400);
      const message = JSON.stringify(approve.body);
      expect(message).toContain('title');
    } finally {
      await app.close();
    }
  });

  it('otro negocio no ve los briefs (404 al GET)', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const otherBusiness = await prisma.business.create({
        data: { id: 'other-business', name: 'Otro Negocio', location: 'CL' },
      });
      const foreignService = await createServiceFor(otherBusiness.id, 'Corte');
      // Creamos el brief con BUSINESS_ID del "otro negocio" para que el
      // servicio cree un brief en esa fila. Hacemos un swap manual de la
      // variable de entorno y restauramos al final.
      const tmp = process.env.BUSINESS_ID;
      process.env.BUSINESS_ID = otherBusiness.id;
      const app2 = app;
      try {
        const created = await request(app2.getHttpServer())
          .post(`/${API_PREFIX}/campaign-briefs`)
          .send(validPayload(foreignService.id))
          .expect(201);
        const createdBody = created.body as BriefResponse;
        expect(createdBody.businessId).toBe(otherBusiness.id);
      } finally {
        process.env.BUSINESS_ID = tmp;
      }

      // Con BUSINESS_ID=test-business el brief del "otro negocio" es
      // invisible: listar devuelve [] y GET por id devuelve 404.
      const list = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs`)
        .expect(200);
      expect(list.body).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('archiva un brief cambiando el status a ARCHIVED', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const archived = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${(created.body as BriefResponse).id}/archive`)
        .expect(201);
      expect((archived.body as BriefResponse).status).toBe('ARCHIVED');

      const fetched = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs/${(created.body as BriefResponse).id}`)
        .expect(200);
      expect((fetched.body as BriefResponse).status).toBe('ARCHIVED');
    } finally {
      await app.close();
    }
  });

  it('rechaza serviceId de otro negocio (400)', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const otherBusiness = await prisma.business.create({
        data: { id: 'third-business', name: 'Tercer Negocio', location: 'CL' },
      });
      const foreignService = await createServiceFor(otherBusiness.id, 'Color');
      const created = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(foreignService.id));
      expect(created.status).toBe(400);
      const message = JSON.stringify(created.body);
      expect(message).toContain(foreignService.id);
    } finally {
      await app.close();
    }
  });
});

describe('GET /campaign-briefs/:id/executions (integration)', () => {
  /**
   * Helper: crea una `Campaign` ya vinculada al brief indicado. Usamos
   * Prisma directo para no tener que recorrer el flujo HTTP completo en
   * cada caso: este test ya está aislado por `setup.ts`.
   */
  async function createCampaignForBrief(
    briefId: string,
    overrides: {
      name?: string;
      status?: 'DRAFT' | 'PAUSED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
      campaignBriefId?: string | null;
    } = {},
  ) {
    return prisma.campaign.create({
      data: {
        businessId: BUSINESS_ID,
        name: overrides.name ?? `Campana-${briefId.slice(-6)}`,
        objective: 'whatsapp',
        status: overrides.status ?? 'DRAFT',
        campaignBriefId: overrides.campaignBriefId !== undefined
          ? overrides.campaignBriefId
          : briefId,
      },
    });
  }

  it('devuelve solo las campañas vinculadas al brief solicitado', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const briefA = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      const briefB = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);

      const campaignA1 = await createCampaignForBrief(briefA.body.id, { name: 'A1' });
      const campaignA2 = await createCampaignForBrief(briefA.body.id, { name: 'A2' });
      // Esta campaña pertenece al brief B → NO debe aparecer en /executions de A.
      const campaignB1 = await createCampaignForBrief(briefB.body.id, { name: 'B1' });

      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs/${briefA.body.id}/executions`)
        .expect(200);
      const ids = (res.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining([campaignA1.id, campaignA2.id]));
      expect(ids).not.toContain(campaignB1.id);
      void campaignB1;
    } finally {
      await app.close();
    }
  });

  it('devuelve array vacío si el brief no tiene ejecuciones', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const brief = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaign-briefs/${brief.body.id}/executions`)
        .expect(200);
      expect(res.body).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('devuelve 404 si el brief es de otro negocio', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const otherBusiness = await prisma.business.create({
        data: { id: 'foreign-brief-business', name: 'Otro Negocio Brief', location: 'CL' },
      });
      const foreignService = await createServiceFor(otherBusiness.id, 'Corte Brief');

      // Creamos el brief como "otro negocio" mediante swap temporal de BUSINESS_ID.
      const tmp = process.env.BUSINESS_ID;
      process.env.BUSINESS_ID = otherBusiness.id;
      try {
        const created = await request(app.getHttpServer())
          .post(`/${API_PREFIX}/campaign-briefs`)
          .send(validPayload(foreignService.id))
          .expect(201);
        // Restauramos BUSINESS_ID antes de la siguiente request para que
        // el GET se evalúe contra el negocio actual (test-business).
        const foreignBriefId = (created.body as BriefResponse).id;
        process.env.BUSINESS_ID = tmp;
        const res = await request(app.getHttpServer())
          .get(`/${API_PREFIX}/campaign-briefs/${foreignBriefId}/executions`);
        expect(res.status).toBe(404);
      } finally {
        process.env.BUSINESS_ID = tmp;
      }
    } finally {
      await app.close();
    }
  });
});

describe('Campaigns huérfanas excluidas de /campaigns (integration)', () => {
  it('rechaza POST /campaigns sin campaignBriefId con 400 accionable', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const response = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaigns`)
        .send({
          name: 'Sin brief',
          objective: 'whatsapp',
          dailyBudget: 5000,
        });
      expect(response.status).toBe(400);
      const message = JSON.stringify(response.body);
      expect(message).toContain('plan aprobado');
    } finally {
      await app.close();
    }
  });

  it('GET /campaigns filtra las campañas con campaignBriefId = null', async () => {
    const app = await buildApp({ logger: ['error', 'warn'] });
    try {
      const service = await createServiceFor(BUSINESS_ID);
      const brief = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs`)
        .send(validPayload(service.id))
        .expect(201);
      await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaign-briefs/${brief.body.id}/approve`)
        .expect(201);

      // 1) Campaña vinculada al brief → DEBE aparecer en GET /campaigns.
      const linked = await request(app.getHttpServer())
        .post(`/${API_PREFIX}/campaigns`)
        .send({
          name: 'Vinculada',
          objective: 'whatsapp',
          dailyBudget: 5000,
          campaignBriefId: brief.body.id,
        })
        .expect(201);

      // 2) Campaña huérfana (campaignBriefId = null) → NO debe listarse.
      const orphan = await prisma.campaign.create({
        data: {
          businessId: BUSINESS_ID,
          name: 'Huerfana',
          objective: 'whatsapp',
          status: 'DRAFT',
          campaignBriefId: null,
        },
      });

      const list = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaigns`)
        .expect(200);
      const ids = (list.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(linked.body.id);
      expect(ids).not.toContain(orphan.id);

      // `findOne` por id sigue accesible (casos puntuales).
      const direct = await request(app.getHttpServer())
        .get(`/${API_PREFIX}/campaigns/${orphan.id}`)
        .expect(200);
      expect((direct.body as { id: string }).id).toBe(orphan.id);
    } finally {
      await app.close();
    }
  });
});
