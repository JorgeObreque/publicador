import { test, expect } from '@playwright/test';
import { Client } from 'pg';

/**
 * E2E del flujo unificado de "Planes comerciales":
 *
 *  1. La navegación del header debe apuntar a `/campaign-brief`
 *     ("Planes comerciales") en vez de `/campaigns` ("Campañas").
 *  2. `/campaigns` debe redirigir a `/campaign-brief` (permanentemente).
 *  3. `/campaigns/new` sin `briefId` debe redirigir al diagnóstico.
 *  4. Un brief APPROVED debe permitir crear múltiples ejecuciones
 *     (wizard → guardar borrador → vuelta al plan, no a `/campaigns/:id`).
 *  5. El breadcrumb del detalle de ejecución debe mostrar el plan del
 *     que proviene.
 *  6. Las campañas huérfanas (`campaignBriefId = NULL`) NO deben
 *     aparecer en el listado de planes ni en `GET /campaigns`.
 *
 * Notas de diseño:
 *  - Limpiamos la BD en `beforeAll` para que los conteos y los nombres
 *    de planes/ejecuciones sean deterministas.
 *  - El brief se crea vía API (`POST /commercial-diagnoses` + `/accept`).
 *    Como OpenAI puede no estar configurado en CI, el servicio cae a
 *    un fallback determinista que crea el brief en estado APPROVED.
 *  - Para el wizard sembramos un `MediaAsset` real (vía SQL) y
 *    dejamos que el backend lo exponga: así no dependemos de Google
 *    Drive ni de la publicación real en Meta.
 *  - Interceptamos `POST /campaigns/with-creative` sólo para
 *    redirigir la creación a una llamada `request.post(...)` que sí
 *    ejecuta la lógica real del backend (necesitamos la campaña
 *    persistida para el resto de los tests).
 */

type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

const BUSINESS_ID = 'test-business';
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://publicador:publicador@127.0.0.1:5434/publicador_test?schema=public';

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

async function createDbClient(): Promise<DbClient> {
  const url = new URL(getDatabaseUrl());
  const client = new Client({
    host: url.hostname || '127.0.0.1',
    port: Number(url.port || 5434),
    user: decodeURIComponent(url.username || 'publicador'),
    password: decodeURIComponent(url.password || 'publicador'),
    database: (url.pathname || '/publicador_test').replace(/^\//, ''),
  });
  await client.connect();
  return client as unknown as DbClient;
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1';
}

interface DiagnosisResponse {
  id: string;
  status: 'IN_PROGRESS' | 'READY' | 'ACCEPTED' | 'ARCHIVED';
  campaignBriefId: string | null;
}

interface AcceptResponse {
  diagnosis: DiagnosisResponse;
  campaignBrief: {
    id: string;
    title: string;
    status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  };
}

const SITUATION_TEXT =
  'Tengo clientas principalmente jueves, viernes, sábado y domingo. Lunes, martes y miércoles tengo bastante disponibilidad. Quiero llenar los huecos entre semana con un plan concreto.';

test.describe.serial('Planes comerciales – flujo unificado', () => {
  let db: DbClient;
  let balayageServiceId: string;
  let mediaAssetId: string;
  let briefId: string;
  let briefTitle: string;
  let campaignId: string;

  test.beforeAll(async ({ request }) => {
    db = await createDbClient();

    // Limpia los datos que el seed no recrea cada vez (campañas,
    // diagnoses, briefs). NO tocamos `Business`, `BusinessProfile`,
    // `Service` ni `MediaAsset` porque el `globalSetup` los siembra
    // idempotentemente al inicio de la suite.
    await db.query(
      `DELETE FROM "CampaignCreative" WHERE "businessId" = $1`,
      [BUSINESS_ID],
    );
    await db.query(`DELETE FROM "Campaign" WHERE "businessId" = $1`, [BUSINESS_ID]);
    await db.query(
      `DELETE FROM "DiagnosticAnswer" WHERE "diagnosisId" IN (SELECT id FROM "CommercialDiagnosis" WHERE "businessId" = $1)`,
      [BUSINESS_ID],
    );
    await db.query(
      `DELETE FROM "CommercialDiagnosis" WHERE "businessId" = $1`,
      [BUSINESS_ID],
    );
    await db.query(
      `DELETE FROM "CampaignBrief" WHERE "businessId" = $1`,
      [BUSINESS_ID],
    );

    // Resuelve el servicio "Balayage" que sembramos en el seed y que
    // será el `serviceId` del diagnóstico.
    const serviceRows = (await db.query(
      `SELECT id FROM "Service" WHERE "businessId" = $1 AND name = 'Balayage' LIMIT 1`,
      [BUSINESS_ID],
    )).rows as Array<{ id: string }>;
    if (serviceRows.length === 0) {
      throw new Error('No se encontró el servicio "Balayage" del seed.');
    }
    balayageServiceId = serviceRows[0]!.id;

    // Sembra un MediaAsset de tipo IMAGE que el wizard pueda seleccionar
    // cuando atraviese el paso "Imagen o video". Es la fuente de verdad
    // que verá el front (no mockeamos este endpoint para mantener el
    // camino feliz lo más cercano a producción).
    const existingAsset = (
      await db.query(
        `SELECT id FROM "MediaAsset" WHERE "businessId" = $1 AND "externalFileId" = 'e2e-balayage-asset' LIMIT 1`,
        [BUSINESS_ID],
      )
    ).rows as Array<{ id: string }>;
    if (existingAsset.length > 0) {
      mediaAssetId = existingAsset[0]!.id;
    } else {
      mediaAssetId = `e2e-media-${Date.now()}`;
      await db.query(
        `INSERT INTO "MediaAsset"
          (id, "businessId", source, kind, "externalFileId", name, "mimeType", "sizeBytes", status, "lastSyncedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, 'URL', 'IMAGE', $3, $4, 'image/jpeg', 12345, 'READY', NOW(), NOW(), NOW())`,
        [mediaAssetId, BUSINESS_ID, 'e2e-balayage-asset', 'Balayage referencia'],
      );
    }

    // Crea el brief vía API: diagnóstico + accept. Con OpenAI no
    // configurado el servicio cae al fallback determinista (READY) y
    // `accept` lo materializa como brief APPROVED.
    const diagnosisRes = await request.post(`${getApiBase()}/commercial-diagnoses`, {
      data: {
        currentSituation: SITUATION_TEXT,
        serviceId: balayageServiceId,
      },
    });
    expect(diagnosisRes.ok()).toBe(true);
    const diagnosis = (await diagnosisRes.json()) as DiagnosisResponse;
    expect(diagnosis.status).toBe('READY');

    const acceptRes = await request.post(
      `${getApiBase()}/commercial-diagnoses/${diagnosis.id}/accept`,
    );
    expect(acceptRes.ok()).toBe(true);
    const accepted = (await acceptRes.json()) as AcceptResponse;
    expect(accepted.diagnosis.campaignBriefId).toBeTruthy();
    briefId = accepted.campaignBrief.id!;
    briefTitle = accepted.campaignBrief.title;
  });

  test.afterAll(async () => {
    if (db) {
      await db.end();
    }
  });

  test('el flujo Planes comerciales reemplaza la pestaña Campañas', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header').first();
    await expect(header.getByRole('link', { name: 'Planes comerciales' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Cuenta' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Citas' })).toBeVisible();
    // La etiqueta legacy "Campañas" no debe existir en el header.
    await expect(header.getByRole('link', { name: /^Campañas$/ })).toHaveCount(0);
    // El href legacy `/campaigns` no debe estar en el header.
    await expect(header.locator('a[href="/campaigns"]')).toHaveCount(0);

    const navLinks = header.locator('nav a');
    await expect(navLinks).toHaveCount(4);
    await expect(navLinks.nth(0)).toHaveText('Inicio');
    await expect(navLinks.nth(1)).toHaveText('Cuenta');
    await expect(navLinks.nth(2)).toHaveText('Planes comerciales');
    await expect(navLinks.nth(3)).toHaveText('Citas');
  });

  test('/campaigns redirige a /campaign-brief', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/\/campaign-brief$/);
    await expect(
      page.getByRole('heading', { name: 'Planes comerciales', level: 2 }),
    ).toBeVisible();
  });

  test('/campaigns/new sin brief redirige al diagnóstico', async ({ page }) => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL(/\/campaign-brief\/new$/);
    await expect(
      page.getByRole('heading', { name: 'Busquemos la próxima oportunidad' }),
    ).toBeVisible();
  });

  test('un brief aprobado puede tener múltiples ejecuciones', async ({ page, request }) => {
    // 1. La página /campaign-brief lista el plan recién aprobado.
    await page.goto('/campaign-brief');
    const briefListItem = page.getByTestId(`briefs-list-item-${briefId}`);
    await expect(briefListItem).toBeVisible();
    await expect(briefListItem.getByText(briefTitle)).toBeVisible();
    await expect(briefListItem.getByText('Ejecuciones (0)')).toBeVisible();

    const createExecutionLink = page.getByTestId(
      `briefs-list-create-execution-${briefId}`,
    );
    await expect(createExecutionLink).toBeVisible();

    // 2. Click → abre el wizard pre-poblado con `?briefId=<id>`.
    await createExecutionLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/campaigns/new\\?briefId=${briefId}`),
    );

    // 3. Intercepta `POST /campaigns/with-creative` para que la UI no
    // publique en Meta y para tener control del id resultante.
    // Aprovechamos para llamar al backend real con el mediaAssetId
    // sembrado y devolver su respuesta.
    await page.route('**/api/v1/campaigns/with-creative', async (route) => {
      const requestBody = route.request().postDataJSON() as {
        campaign: { name?: string; campaignBriefId?: string };
      };
      const name = requestBody.campaign?.name || 'Ejecución E2E';
      const createRes = await request.post(
        `${getApiBase()}/campaigns/with-creative`,
        {
          data: {
            campaign: {
              name,
              objective: 'Recibir consultas por WhatsApp',
              serviceId: balayageServiceId,
              dailyBudget: 5000,
              campaignBriefId: briefId,
            },
            creative: {
              name: 'Balayage E2E',
              format: 'image',
              primaryText: 'Balayage natural con profesionales.',
              headline: 'Reserva tu balayage',
              callToAction: 'WHATSAPP_MESSAGE',
              mediaAssetId,
            },
            isControl: true,
          },
        },
      );
      if (!createRes.ok()) {
        await route.fulfill({
          status: createRes.status(),
          contentType: 'application/json',
          body: JSON.stringify({ message: await createRes.text() }),
        });
        return;
      }
      const created = (await createRes.json()) as {
        campaign: { id: string };
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    });

    // 4. Paso "Servicio" (ServiceStep): el brief pre-rellena name y
    // serviceId. Solo necesitamos avanzar.
    await expect(
      page.getByRole('heading', { name: '¿Qué quieres promocionar?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // 5. Paso "Imagen o video" (ImageStep): seleccionamos el asset
    // sembrado que devuelve el backend real.
    await expect(
      page.getByRole('heading', { name: 'Imagen o video' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Balayage referencia/ }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // 6. Paso "Mensaje" (CopyStep): pegamos texto principal y título.
    await expect(
      page.getByRole('heading', { name: 'Escribe el anuncio' }),
    ).toBeVisible();
    await page
      .getByPlaceholder('Balayage natural con profesionales. Reserva por WhatsApp.')
      .fill('Balayage natural con profesionales expertas.');
    await page.getByPlaceholder('Reserva tu balayage').fill('Reserva tu balayage');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // 7. Paso "Presupuesto" (BudgetStep): 5000 CLP diarios durante 14
    // días (coherente con la creación real de la campaña).
    await expect(
      page.getByRole('heading', { name: 'Presupuesto y duración' }),
    ).toBeVisible();

    // La tarjeta de recomendación debe exponer el snapshot del CPA
    // objetivo y del tope. El seed del test fija `costPerAcquisitionCap`
    // en el `BusinessProfile`, por lo que `recommendedCpaCap` queda
    // siempre propagado al wizard tras el `accept` del diagnóstico y el
    // snapshot de `budget-recommendation-cpa` debe estar visible.
    const cpaSnapshot = page.getByTestId('budget-recommendation-cpa');
    await expect(cpaSnapshot).toBeVisible();

    const dailyBudgetInput = page.locator('input[type="number"]').first();
    await dailyBudgetInput.fill('5000');
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const endDate = new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(startDate);
    await dateInputs.nth(1).fill(endDate);
    await page.getByRole('button', { name: 'Continuar' }).click();

    // 8. Paso "Revisión" (ReviewStep): guardar borrador. Esto llama a
    // `createCampaignWithCreative`, que hemos interceptado para que
    // cree la campaña real vía API y luego el componente redirige a
    // `/campaign-brief/<briefId>` (NO a `/campaigns/<campaignId>`).
    await expect(
      page.getByRole('heading', { name: 'Revisa la campaña' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Guardar borrador/i }).click();

    await page.waitForURL(new RegExp(`/campaign-brief/${briefId}$`));
    await expect(page).not.toHaveURL(/\/campaigns\//);

    // 9. Lee la ejecución creada desde la API para los siguientes
    // tests (breadcrumb, listado).
    const briefDetail = await request.get(
      `${getApiBase()}/campaign-briefs/${briefId}`,
    );
    expect(briefDetail.ok()).toBe(true);
    const detail = (await briefDetail.json()) as {
      executions: Array<{ id: string }>;
    };
    expect(detail.executions.length).toBe(1);
    campaignId = detail.executions[0]!.id;

    // 10. Volvemos al listado de planes y verificamos que el contador
    // refleja la nueva ejecución. La página de detalle del brief
    // (`/campaign-brief/<id>`) sólo tiene el resumen y el form, así
    // que el panel "Ejecuciones" sólo aparece en `/campaign-brief`.
    await page.goto('/campaign-brief');
    const updatedListItem = page.getByTestId(`briefs-list-item-${briefId}`);
    await expect(updatedListItem.getByText('Ejecuciones (1)')).toBeVisible();
    await expect(
      updatedListItem.getByTestId(`briefs-list-execution-${campaignId}`),
    ).toBeVisible();

    // Liberamos la ruta interceptada para no contaminar otros tests.
    await page.unroute('**/api/v1/campaigns/with-creative');
  });

  test('el breadcrumb del detalle de ejecución muestra el plan', async ({ page, request }) => {
    // Garantiza que tenemos una ejecución contra la que verificar el
    // breadcrumb. El test anterior la crea si todo va bien, pero si la
    // suite se interrumpe entre ambos tests seguimos pudiendo probar
    // el breadcrumb creando la ejecución directamente.
    if (!campaignId) {
      const createRes = await request.post(`${getApiBase()}/campaigns/with-creative`, {
        data: {
          campaign: {
            name: 'Ejecución breadcrumb',
            objective: 'Recibir consultas por WhatsApp',
            serviceId: balayageServiceId,
            dailyBudget: 5000,
            campaignBriefId: briefId,
          },
          creative: {
            name: 'Balayage breadcrumb',
            format: 'image',
            primaryText: 'Balayage natural con profesionales.',
            headline: 'Reserva tu balayage',
            callToAction: 'WHATSAPP_MESSAGE',
            mediaAssetId,
          },
          isControl: true,
        },
      });
      expect(createRes.ok()).toBe(true);
      const created = (await createRes.json()) as { campaign: { id: string } };
      campaignId = created.campaign.id;
    }

    // Recupera el nombre real de la campaña para poder verificarlo en
    // el breadcrumb (no asumimos un valor fijo porque la UI usa el
    // nombre que el operador puso en el wizard).
    const campaignRes = await request.get(
      `${getApiBase()}/campaigns/${campaignId}`,
    );
    expect(campaignRes.ok()).toBe(true);
    const campaign = (await campaignRes.json()) as { name: string };

    await page.goto(`/campaigns/${campaignId}`);

    const breadcrumb = page.getByRole('navigation', {
      name: 'Ruta de navegación',
    });
    await expect(breadcrumb).toBeVisible();
    await expect(
      breadcrumb.getByRole('link', { name: 'Planes comerciales' }),
    ).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: briefTitle })).toBeVisible();
    await expect(breadcrumb.getByText(campaign.name)).toBeVisible();
  });

  test('las campañas sin brief no aparecen en /campaign-brief', async ({ page, request }) => {
    // Crea una campaña huérfana (campaignBriefId = NULL) directamente
    // en la BD. La API rechaza este caso (campaignBriefId obligatorio),
    // por lo que NO podemos crearla por HTTP: usamos SQL.
    const orphanName = `Huérfana E2E ${Date.now()}`;
    const serviceRow = (
      await db.query(
        `SELECT id FROM "Service" WHERE "businessId" = $1 AND name = 'Corte' LIMIT 1`,
        [BUSINESS_ID],
      )
    ).rows as Array<{ id: string }>;
    const fallbackService =
      serviceRow.length > 0 ? serviceRow[0]!.id : balayageServiceId;
    const orphanId = `orphan-${Date.now()}`;
    await db.query(
      `INSERT INTO "Campaign"
         (id, "businessId", "serviceId", name, objective, status, "metaPublishStatus",
          "createdAt", "updatedAt", "campaignBriefId")
       VALUES ($1, $2, $3, $4, 'Recibir consultas por WhatsApp', 'DRAFT', 'DRAFT',
               NOW(), NOW(), NULL)`,
      [orphanId, BUSINESS_ID, fallbackService, orphanName],
    );

    try {
      // /campaign-brief lista planes con ejecuciones vinculadas. La
      // huérfana no debe aparecer ni en la lista del brief ni en el
      // detalle del plan aprobado del test anterior.
      await page.goto('/campaign-brief');
      await expect(page.getByText(orphanName)).toHaveCount(0);

      await page.goto(`/campaign-brief/${briefId}`);
      await expect(page.getByText(orphanName)).toHaveCount(0);

      // La API `GET /campaigns` tampoco debe incluirla (P1-4: las
      // huérfanas quedan ocultas en el listado público).
      const list = await request.get(`${getApiBase()}/campaigns`);
      expect(list.ok()).toBe(true);
      const campaigns = (await list.json()) as Array<{ id: string; name: string }>;
      expect(campaigns.find((row) => row.id === orphanId)).toBeUndefined();
    } finally {
      // Limpia la huérfana aunque el assert falle para no contaminar
      // otros tests que vivan en el mismo `test-business`.
      await db.query(`DELETE FROM "Campaign" WHERE id = $1`, [orphanId]);
    }
  });
});