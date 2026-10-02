import { z } from 'zod';

/**
 * Esquemas Zod para la entrada y salida del módulo `BusinessProfile`.
 *
 * El contrato se valida en el controlador con `parse(...)` y cualquier
 * fallo se traduce en `BadRequestException` (mismo patrón que ya usan
 * `campaigns/dto/campaign.dto.ts` y `creatives/dto/creative.dto.ts`).
 *
 * Reglas:
 * - Todos los campos son opcionales salvo `primaryCustomerProfile`, que se
 *   valida con `min(1)` (no se acepta un perfil "vacío" en `primaryCustomerProfile`).
 * - Las cadenas tienen un tope razonable (`max`) para evitar payloads
 *   abusivos.
 * - Los arrays tienen `max(itemCount)` para impedir crecer el perfil sin
 *   control.
 * - Para `Decimal` (monto/cap) usamos `coerce.number()` con un refine que
 *   rechaza NaN/Infinity pero acepta 0 (interpretado como "no tengo tope").
 *
 * A partir del corte territorial SUBDERE 2018, los campos libres
 * `city/region/country` se reemplazaron por códigos oficiales:
 * - `regionCutCode` debe existir en el catálogo territorial.
 * - `communeCutCode` debe existir y pertenecer a la región indicada.
 * - `countryCode` se asume `CL` por defecto (Chile); si se omite en la
 *   entrada, el service lo rellena automáticamente.
 */

const TEXT_FIELDS = {
  addressLine: z.string().trim().max(200).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  regionCutCode: z.string().trim().min(1).max(8).optional(),
  communeCutCode: z.string().trim().min(1).max(8).optional(),
  countryCode: z.string().trim().min(2).max(8).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsappNumber: z.string().trim().max(40).optional(),
  publicEmail: z.string().trim().email().max(180).optional(),
  googleMapsUrl: z.string().trim().url().max(500).optional(),
  tagline: z.string().trim().max(200).optional(),
} as const;

const ITEM_FIELDS = {
  brandVoiceKeywords: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  wordsToAvoid: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  preferredEmojiSemantics: z.array(z.string().trim().min(1).max(8)).max(10).optional(),
  commonObjections: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
  qualifyingQuestions: z.array(z.string().trim().min(1).max(400)).max(20).optional(),
  differentiators: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
} as const;

/**
 * Códigos CUT (5 dígitos) de comunas vecinas que el operador quiere
 * mantener como referencia en su perfil. El backend sólo valida que el
 * string tenga 5 caracteres; la coherencia con el catálogo territorial
 * se hace en el frontend (la UI propone el top 10 por ingreso y deja
 * al operador ajustar manualmente hasta 10 códigos).
 */
const NEARBY_COMMUNES_FIELD = {
  nearbyCommunesCutCodes: z.array(z.string().length(5)).max(20).optional(),
} as const;

const NUMERIC_FIELDS = {
  weeklyServiceCapacity: z.number().int().nonnegative().optional(),
  monthlyAcquisitionGoal: z.number().int().nonnegative().optional(),
} as const;

const decimalField = (max: number) =>
  z
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, { message: 'Debe ser un número >= 0' })
    .refine((n) => n <= max, { message: `Debe ser ≤ ${max}` })
    .optional();

const CURRENCY_FIELDS = {
  monthlyRevenueTarget: decimalField(1_000_000_000),
  costPerAcquisitionCap: decimalField(1_000_000_000),
} as const;

/**
 * Entrada completa (o parcial) para crear/actualizar el perfil. Todos los
 * campos son opcionales excepto `primaryCustomerProfile` (refleja la regla
 * del dominio: el perfil sin descripción de cliente ideal no es publicable).
 *
 * El schema es `.strict()`: cualquier campo no listado aquí (incluyendo los
 * legacy `city`/`region`/`country`) provoca `BadRequestException`. Esto
 * permite cortar el payload de entrada sin perder el contrato.
 */
export const upsertBusinessProfileSchema = z
  .object({
    ...TEXT_FIELDS,
    ...ITEM_FIELDS,
    ...NEARBY_COMMUNES_FIELD,
    ...NUMERIC_FIELDS,
    ...CURRENCY_FIELDS,
    primaryCustomerProfile: z.string().trim().min(1).max(2000),
  })
  .strict();

export type UpsertBusinessProfileInput = z.infer<typeof upsertBusinessProfileSchema>;

export type BusinessProfileResponse = {
  id: string;
  businessId: string;
  addressLine: string | null;
  neighborhood: string | null;
  regionCutCode: string | null;
  communeCutCode: string | null;
  regionName: string | null;
  communeName: string | null;
  countryCode: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  publicEmail: string | null;
  googleMapsUrl: string | null;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  preferredEmojiSemantics: string[];
  primaryCustomerProfile: string;
  commonObjections: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: number | null;
  monthlyRevenueTarget: string | null;
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: string | null;
  tagline: string | null;
  differentiators: string[];
  nearbyCommunesCutCodes: string[];
  profileCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Forma serializada del perfil expuesta por la API. Mantiene la forma
 * `Decimal` de Prisma como string para que el frontend la reciba como un
 * número portable sin perder precisión (CLP no tiene decimales pero la
 * columna es `Decimal(12,2)`).
 */
export const BUSINESS_PROFILE_MAX_ARRAY_ITEMS = {
  brandVoiceKeywords: 30,
  wordsToAvoid: 50,
  preferredEmojiSemantics: 10,
  commonObjections: 20,
  qualifyingQuestions: 20,
  differentiators: 10,
  nearbyCommunesCutCodes: 20,
} as const;

export const DEFAULT_COUNTRY_CODE = 'CL';
