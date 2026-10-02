import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CommercialDiagnosisStatus,
  Prisma,
  type CommercialDiagnosis,
  type DiagnosticAnswer,
  type Prisma as PrismaTypes,
} from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { OPENAI_CLIENT, type OpenAIClientToken } from '../analyze/analyze.tokens';
import type { OpenAISummaryResult } from '../analyze/openai.client';
import {
  BUSINESS_PROFILE_SERVICE,
  type BusinessProfileServiceToken,
} from '../business-profile/business-profile.tokens';
import { CampaignBriefService } from '../campaign-brief/campaign-brief.service';
import type { CampaignBriefResponse } from '../campaign-brief/dto/campaign-brief.dto';
import {
  COMMERCIAL_DIAGNOSIS_MAX_QUESTIONS,
  OPEN_AI_DECISION_SCHEMA,
  RECOMMENDED_FALLBACK_OFFER,
  RECOMMENDED_FALLBACK_TITLE,
  type AcceptDiagnosisResponse,
  type AdjustDiagnosisInput,
  type AnswerQuestionInput,
  type CommercialDiagnosisResponse,
  type ProvenanceEntry,
  type ProvenanceMap,
  type RecommendedMeta,
  type StartDiagnosisInput,
} from './dto/commercial-diagnosis.dto';
import {
  buildAdjustmentPrompt,
  buildDiagnosisPrompt,
} from './commercial-diagnosis.prompt';
import { DiagnosisEvidenceService } from './diagnosis-evidence.service';
import { BudgetRecommendationService } from './budget-recommendation.service';
import {
  buildDiagnosisPayload,
  type DiagnosisContext,
  type DiagnosisPayload,
  type DiagnosticConversationEntry,
  type EvidenceMode,
  type ParsedDiagnosisDecision,
  type StrategyShape,
} from './commercial-diagnosis.types';

/**
 * Servicio que orquesta el "diagnóstico comercial" del negocio:
 * toma la situación actual como texto libre, dialoga con la IA
 * (máximo 3 preguntas aclaratorias una-a-una) y, cuando tiene
 * suficiente información, propone una meta medible que al aceptarse
 * genera un `CampaignBrief` aprobado.
 *
 * Diseño (similar a `CampaignBriefSuggestRulesService`):
 *
 *  1. Lee el `BusinessProfile` y los servicios activos. Si el perfil no
 *     está completo, devuelve 400 con un mensaje claro para la UI.
 *  2. Construye el `DiagnosisPayload` y llama al cliente OpenAI.
 *  3. Parsea la respuesta con un parser tolerante (acepta variantes
 *     razonables del JSON). Si la IA devuelve `decision: 'ASK'` con
 *     una pregunta concreta, persiste un `DiagnosticAnswer` con
 *     `wasClarification: true` y mantiene la diagnosis en
 *     `IN_PROGRESS`. Si devuelve `decision: 'READY'`, persiste la
 *     `recommended` (y la estrategia si la IA la provee) y marca el
 *     estado `READY`.
 *  4. Si OpenAI no está configurado o falla, cae a un fallback
 *     determinista basado en la situación libre y los servicios
 *     activos. La fallback marca `provenance` con `SYSTEM_CALCULATION`
 *     para los campos derivados.
 *  5. En el endpoint `accept`, materializa la `recommended` como un
 *     `CampaignBrief` aprobado, dejando la diagnosis ligada al brief.
 *
 * Reglas de robustez:
 *  - Máximo 3 preguntas por diagnosis: si la IA insiste, el servicio
 *    fuerza una decisión `READY` con fallback determinista.
 *  - Si la IA devuelve `ASK` sin `questionKey`/`questionText` válidos,
 *    también fuerza `READY` con fallback.
 *  - Todos los `Decimal` de Prisma se serializan como string (alineado
 *    con `campaign-brief.service.ts`).
 */


const toIsoDate = (value: Date | string): string => {
  if (typeof value === 'string') return value;
  const d = value;
  const yyyy = d.getUTCFullYear();
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Marcadores internos que el servicio persiste codificados en arrays
 * públicos (`assumptions`, `qualifyingQuestions`) para no requerir
 * migraciones de schema mientras se itera el modelo. El serializer los
 * filtra antes de devolverlos al cliente.
 */
const CPA_RATIONALE_PREFIX = '__cpaRationale__:';
const PRICE_JUSTIFICATION_PREFIX = '__priceJustification__:';

/**
 * Filtra los marcadores internos (`__cpaRationale__:`,
 * `__priceJustification__:`) de un array público antes de la
 * serialización. Mantiene el resto del contenido estable. Si en el
 * futuro se agregan columnas dedicadas, este filtro deja de ser
 * necesario.
 */
const stripInternalAssumptionMarkers = (entries: string[]): string[] =>
  entries.filter(
    (entry) =>
      !entry.startsWith(CPA_RATIONALE_PREFIX) &&
      !entry.startsWith(PRICE_JUSTIFICATION_PREFIX),
  );

const stripInternalQualifyingMarkers = (entries: string[]): string[] =>
  entries.filter((entry) => !entry.startsWith(PRICE_JUSTIFICATION_PREFIX));

/**
 * Codifica `priceJustification` en `qualifyingQuestions` con el prefijo
 * `__priceJustification__:` para persistirlo sin migración de schema.
 * El decoder vive en `extractPriceJustification`. Si la justificación
 * es null/vacía, simplemente filtramos cualquier marcador existente
 * (limpieza: registros previos pueden tenerlo).
 */
const persistPriceJustification = (
  qualifyingQuestions: string[],
  priceJustification: string | null,
): string[] => {
  // Limpiamos marcadores previos para no acumular duplicados.
  const cleaned = stripInternalQualifyingMarkers(qualifyingQuestions);
  if (priceJustification === null || priceJustification.length === 0) {
    return cleaned;
  }
  return [`${PRICE_JUSTIFICATION_PREFIX}${priceJustification}`, ...cleaned];
};

type DiagnosisRecord = Prisma.CommercialDiagnosisGetPayload<{
  include: { answers: true };
}>;

type ServiceRecord = Prisma.ServiceGetPayload<{
  select: {
    id: true;
    name: true;
    description: true;
    price: true;
    currency: true;
    duration: true;
    isActive: true;
  };
}>;

const MAX_MODEL_ATTEMPTS = 2;

@Injectable()
export class CommercialDiagnosisService {
  private readonly logger = new Logger(CommercialDiagnosisService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAIClientToken,
    @Inject(BUSINESS_PROFILE_SERVICE)
    private readonly businessProfile: BusinessProfileServiceToken,
    private readonly briefs: CampaignBriefService,
    private readonly evidence: DiagnosisEvidenceService,
    private readonly budgetRecommendation: BudgetRecommendationService,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  // ---------------------------------------------------------------------------
  // Métodos públicos
  // ---------------------------------------------------------------------------

  /**
   * Inicia una diagnosis nueva. Carga perfil + servicios, llama al
   * modelo con el prompt inicial y persiste la respuesta según la
   * decisión de la IA.
   *
   * Si el perfil no está listo, lanza 400 con un mensaje claro (la
   * diagnosis depende del contexto del negocio y no se puede improvisar).
   * Si el negocio no tiene al menos un servicio activo, también falla.
   * Si la IA devuelve ASK con `pendingQuestion` inválida (key/text
   * vacíos), fuerza fallback READY (P1-3) para no dejar la diagnosis
   * en estado irrecuperable.
   */
  async start(input: StartDiagnosisInput): Promise<CommercialDiagnosisResponse> {
    const businessId = this.businessId;
    const profile = await this.businessProfile.getOrCreate();
    if (!this.businessProfile.isReady(profile)) {
      throw new BadRequestException(
        'Define el contexto del negocio antes de iniciar un diagnóstico',
      );
    }
    // P1-5: validar que `serviceId` (cuando viene) pertenece al negocio y
    // está activo. Si no, devolvemos 400 antes de invocar el modelo.
    if (input.serviceId) {
      const owned = await prisma.service.findFirst({
        where: { id: input.serviceId, businessId, isActive: true },
        select: { id: true },
      });
      if (!owned) {
        throw new BadRequestException(
          `El servicio ${input.serviceId} no pertenece al negocio actual o no está activo`,
        );
      }
    }
    const services = await this.loadServices(businessId, input.serviceId ?? null);
    if (services.length === 0) {
      throw new BadRequestException(
        'El negocio no tiene servicios activos. Crea al menos uno antes de iniciar un diagnóstico.',
      );
    }
    const context = await this.buildContext(profile, services);
    const payload = buildDiagnosisPayload({
      context,
      currentSituation: input.currentSituation,
      serviceId: input.serviceId ?? null,
    });
    const prompts = buildDiagnosisPrompt(payload);
    const fallback = this.buildFallback(payload, 'SYSTEM_CALCULATION');

    const decision = await this.summarizeWithFallback(prompts, payload, fallback);

    // P1-3: si la IA devolvió ASK sin una pregunta válida, NO dejamos la
    // diagnosis colgada en IN_PROGRESS sin DiagnosticAnswer. Forzamos
    // fallback READY y avisamos por log.
    let finalDecision = decision;
    if (
      decision.decision === 'ASK' &&
      !this.isPendingQuestionValid(decision.recommended.pendingQuestion)
    ) {
      this.logger.warn(
        'OpenAI devolvió ASK sin pendingQuestion válida; aplicando fallback READY',
      );
      finalDecision = fallback;
    }

    const primaryService = input.serviceId
      ? services.find((service) => service.id === input.serviceId) ?? services[0]
      : services[0];

    const record = await prisma.commercialDiagnosis.create({
      data: {
        businessId,
        serviceId: primaryService ? primaryService.id : null,
        status:
          finalDecision.decision === 'READY'
            ? CommercialDiagnosisStatus.READY
            : CommercialDiagnosisStatus.IN_PROGRESS,
        currentSituation: input.currentSituation,
        situation: finalDecision.recommended.situation,
        opportunity: finalDecision.recommended.opportunity,
        primaryGoal: finalDecision.recommended.primaryGoal,
        primaryConversion: finalDecision.recommended.primaryConversion,
        recommendedTitle: finalDecision.recommended.recommendedTitle,
        recommendedWeeklyAdd: finalDecision.recommended.recommendedWeeklyAdd,
        availableCapacity: finalDecision.recommended.availableCapacity,
        provenance: finalDecision.provenance as PrismaTypes.InputJsonValue,
        ...(finalDecision.decision === 'READY'
          ? (await this.buildStrategyCreateData(
              businessId,
              primaryService?.id ?? null,
              finalDecision,
            ))
          : {}),
        answers:
            finalDecision.decision === 'ASK' && finalDecision.recommended.pendingQuestion
              ? {
                  create: [
                    {
                      questionKey: finalDecision.recommended.pendingQuestion.key,
                      questionText: finalDecision.recommended.pendingQuestion.text,
                      answerText: null,
                      wasClarification: true,
                      askedAt: new Date(),
                      answeredAt: null,
                    },
                  ],
                }
              : undefined,
      },
      include: { answers: true },
    });

    return this.serialize(record);
  }

  /**
   * Registra la respuesta del operador a la pregunta pendiente y vuelve
   * a invocar a la IA. Si la IA insiste con otra pregunta, persiste un
   * nuevo `DiagnosticAnswer` con `wasClarification: true`. Cuando se
   * alcanza `COMMERCIAL_DIAGNOSIS_MAX_QUESTIONS` y vuelve a pedir, el
   * servicio fuerza `READY` con fallback determinista.
   *
   * Atomicidad (P1-2): la invocación al modelo se hace ANTES de tocar
   * la base de datos. Si el modelo falla no se persiste nada. La
   * transición a `READY`/`IN_PROGRESS` + marcar `answeredAt` + crear la
   * nueva pregunta (si aplica) ocurre dentro de un `prisma.$transaction`,
   * y el `answeredAt` se aplica con `updateMany` + condición
   * `answeredAt IS NULL` para evitar dobles respuestas concurrentes.
   */
  async answer(
    id: string,
    input: AnswerQuestionInput,
  ): Promise<CommercialDiagnosisResponse> {
    const businessId = this.businessId;
    const existing = await this.loadDiagnosis(id, businessId);
    if (existing.status !== CommercialDiagnosisStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Sólo se pueden responder diagnósticos en progreso',
      );
    }
    const pending = this.findPendingAnswer(existing);
    if (!pending) {
      throw new BadRequestException(
        'La diagnosis actual no tiene una pregunta pendiente',
      );
    }
    if (pending.questionKey !== input.questionKey) {
      throw new BadRequestException(
        `La pregunta pendiente tiene key "${pending.questionKey}", no "${input.questionKey}"`,
      );
    }
    // P1-5: reconstruir el contexto SOLO con el servicio asociado a la
    // diagnosis. Si no tiene `serviceId`, se mantiene el comportamiento
    // histórico (todos los servicios activos).
    const serviceRecord = await this.loadServiceForDiagnosis(existing.serviceId);
    const servicesForContext = serviceRecord
      ? [serviceRecord]
      : await this.loadServices(businessId, null);
    const profile = await this.businessProfile.getOrCreate();
    const context = await this.buildContext(profile, servicesForContext);
    const conversation = this.buildConversationFromAnswers(existing.answers, null, {
      questionKey: pending.questionKey,
      questionText: pending.questionText,
      answerText: input.answerText,
    });
    const payload: DiagnosisPayload = buildDiagnosisPayload({
      context,
      currentSituation: existing.currentSituation,
      serviceId: existing.serviceId,
      conversation,
    });
    const prompts = buildDiagnosisPrompt(payload);
    const fallback = this.buildFallback(payload, 'SYSTEM_CALCULATION');
    const questionsAsked = conversation.length;
    const willForceReady =
      questionsAsked >= COMMERCIAL_DIAGNOSIS_MAX_QUESTIONS;

    // P1-2: la llamada al modelo ocurre antes de cualquier escritura.
    // Si la IA falla, NO persistimos nada.
    let decision = await this.summarizeWithFallback(prompts, payload, fallback);
    if (willForceReady && decision.decision !== 'READY') {
      decision = fallback;
    } else if (
      decision.decision === 'ASK' &&
      !this.isPendingQuestionValid(decision.recommended.pendingQuestion)
    ) {
      decision = fallback;
    }

    const now = new Date();

    // P1-2: transición atómica. Dentro de la transacción:
    //  1. Marcamos `answeredAt` con CAS sobre `answeredAt IS NULL` para
    //     impedir dobles respuestas concurrentes (si count === 0, otro
    //     proceso ya respondió: abortamos con 409).
    //  2. Actualizamos la diagnosis (status + recommended + strategy).
    //  3. Si la IA devolvió ASK válida, creamos la nueva pregunta.
    return prisma.$transaction(async (tx) => {
      const answerUpdate = await tx.diagnosticAnswer.updateMany({
        where: { id: pending.id, answeredAt: null, diagnosisId: id },
        data: { answerText: input.answerText, answeredAt: now },
      });
      if (answerUpdate.count === 0) {
        throw new ConflictException(
          'La pregunta pendiente ya fue respondida por otra solicitud',
        );
      }

      const updateData: Prisma.CommercialDiagnosisUpdateInput = {
        status:
          decision.decision === 'READY'
            ? CommercialDiagnosisStatus.READY
            : CommercialDiagnosisStatus.IN_PROGRESS,
        situation: decision.recommended.situation,
        opportunity: decision.recommended.opportunity,
        primaryGoal: decision.recommended.primaryGoal,
        primaryConversion: decision.recommended.primaryConversion,
        recommendedTitle: decision.recommended.recommendedTitle,
        recommendedWeeklyAdd: decision.recommended.recommendedWeeklyAdd,
        availableCapacity: decision.recommended.availableCapacity,
        provenance: decision.provenance as PrismaTypes.InputJsonValue,
      };
      if (decision.decision === 'READY' && decision.strategy) {
        const combined = await this.buildStrategyUpdateData(
          businessId,
          existing.serviceId,
          decision,
        );
        Object.assign(updateData, combined);
      }

      if (decision.decision === 'ASK' && decision.recommended.pendingQuestion) {
        updateData.answers = {
          create: [
            {
              questionKey: decision.recommended.pendingQuestion.key,
              questionText: decision.recommended.pendingQuestion.text,
              answerText: null,
              wasClarification: true,
              askedAt: new Date(),
              answeredAt: null,
            },
          ],
        };
      }

      const updated = await tx.commercialDiagnosis.update({
        where: { id },
        data: updateData,
        include: { answers: true },
      });
      return this.serialize(updated);
    });
  }

  /**
   * Aplica una instrucción libre sobre una diagnosis `READY` o
   * `ACCEPTED`. Si la diagnosis estaba `ACCEPTED`, vuelve a `READY` para
   * forzar la re-confirmación por la operadora.
   *
   * Marca `provenance.recommended.*.source = 'AI_RECOMMENDATION'` para
   * los campos ajustados.
   */
  async adjust(
    id: string,
    input: AdjustDiagnosisInput,
  ): Promise<CommercialDiagnosisResponse> {
    const businessId = this.businessId;
    const existing = await this.loadDiagnosis(id, businessId);
    if (
      existing.status !== CommercialDiagnosisStatus.READY &&
      existing.status !== CommercialDiagnosisStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Sólo se puede ajustar un diagnóstico en estado READY o ACCEPTED',
      );
    }
    // P1-5: reconstruir el contexto SOLO con el servicio asociado a la
    // diagnosis (no todos los servicios del negocio).
    const serviceRecord = await this.loadServiceForDiagnosis(existing.serviceId);
    const servicesForContext = serviceRecord
      ? [serviceRecord]
      : await this.loadServices(businessId, null);
    const profile = await this.businessProfile.getOrCreate();
    const context = await this.buildContext(profile, servicesForContext);
    const conversation = this.buildConversationFromAnswers(existing.answers, null, null);
    const payload = buildDiagnosisPayload({
      context,
      currentSituation: existing.currentSituation,
      serviceId: existing.serviceId,
      conversation,
      existingRecommended: this.recommendedFromRecord(existing),
    });
    const prompts = buildAdjustmentPrompt({ instruction: input.instruction, payload });
    const fallback = this.buildFallback(payload, 'AI_RECOMMENDATION');
    let decision = await this.summarizeWithFallback(prompts, payload, fallback);
    if (decision.decision !== 'READY' || !this.isReadyValid(decision)) {
      decision = fallback;
    }

    const newProvenance: ProvenanceMap = { ...decision.provenance };
    // Marca como AI_RECOMMENDATION los campos que llegan del ajuste (la IA
    // ya los etiquetó en su JSON; preservamos la etiqueta salvo que el
    // fallback se haya aplicado, en cuyo caso overrideamos).
    const fieldsTouched: Array<keyof RecommendedMeta> = [
      'situation',
      'opportunity',
      'primaryGoal',
      'primaryConversion',
      'recommendedTitle',
      'recommendedWeeklyAdd',
      'availableCapacity',
    ];
    for (const field of fieldsTouched) {
      const entry = newProvenance[field];
      const newValue = decision.recommended[field];
      const oldValue = (existing as unknown as Record<string, unknown>)[this.columnForField(field)];
      if (entry) {
        if (this.valuesDiffer(entry.value, newValue) || this.valuesDiffer(entry.value, oldValue)) {
          entry.source = 'AI_RECOMMENDATION';
        }
      } else {
        newProvenance[field] = {
          value: this.normalizeProvenanceValue(newValue),
          source: 'AI_RECOMMENDATION',
        };
      }
    }

    const updateData: Prisma.CommercialDiagnosisUpdateInput = {
      status: CommercialDiagnosisStatus.READY,
      situation: decision.recommended.situation,
      opportunity: decision.recommended.opportunity,
      primaryGoal: decision.recommended.primaryGoal,
      primaryConversion: decision.recommended.primaryConversion,
      recommendedTitle: decision.recommended.recommendedTitle,
      recommendedWeeklyAdd: decision.recommended.recommendedWeeklyAdd,
      availableCapacity: decision.recommended.availableCapacity,
      provenance: newProvenance as PrismaTypes.InputJsonValue,
    };
    if (decision.strategy) {
      const combined = await this.buildStrategyUpdateData(
        businessId,
        existing.serviceId,
        decision,
      );
      Object.assign(updateData, combined);
    }

    const updated = await prisma.commercialDiagnosis.update({
      where: { id },
      data: updateData,
      include: { answers: true },
    });
    return this.serialize(updated);
  }

  /**
   * Acepta una diagnosis `READY` y materializa la `recommended` como un
   * `CampaignBrief` aprobado. La diagnosis queda en estado `ACCEPTED` y
   * ligada al brief resultante.
   *
   * P1-1 — atomicidad e idempotencia:
   *  - Todo el flujo (chequeo CAS, posible re-uso de brief, creación de
   *    brief, aprobación y actualización de la diagnosis) ocurre dentro de
   *    un único `prisma.$transaction`. Si cualquier paso falla, no queda
   *    un brief huérfano en la base.
   *  - El chequeo de estado se hace con `updateMany` + condición
   *    `status === READY` (CAS). Si count === 0, otro proceso aceptó la
   *    diagnosis mientras tanto y devolvemos 409.
   *  - Si la diagnosis ya tiene `campaignBriefId` (caso adjust → re-accept),
   *    recuperamos el brief existente y NO creamos uno nuevo.
   */
  async accept(id: string): Promise<AcceptDiagnosisResponse> {
    const businessId = this.businessId;
    const existing = await this.loadDiagnosis(id, businessId);
    if (existing.status !== CommercialDiagnosisStatus.READY) {
      throw new BadRequestException(
        'Sólo se puede aceptar un diagnóstico en estado READY',
      );
    }
    const profile = await this.businessProfile.getOrCreate();
    const services = await this.loadServices(businessId, existing.serviceId);
    if (services.length === 0) {
      throw new BadRequestException(
        'El negocio ya no tiene servicios activos. Crea uno antes de aceptar el diagnóstico.',
      );
    }
    const primaryService = services[0];

    const recommendedTitle =
      (existing.recommendedTitle ?? '').trim() || RECOMMENDED_FALLBACK_TITLE;
    const recommended = this.recommendedFromRecord(existing);
    const strategy = this.buildStrategyFromRecord(existing, profile);

    // P1-1: ejecutamos TODO dentro de un único `$transaction` para que
    // no quede un brief huérfano si algo falla entre crear y aprobar.
    // Además, si la diagnosis ya tiene `campaignBriefId` (re-accept tras
    // un adjust), reutilizamos el brief existente en lugar de crear uno
    // nuevo.
    return prisma.$transaction(async (tx) => {
      // Re-leemos dentro de la transacción para tomar la versión más
      // reciente (mínimo entre dos requests concurrentes: el CAS de
      // updateMany decide quién gana).
      const fresh = await tx.commercialDiagnosis.findFirst({
        where: { id, businessId },
      });
      if (!fresh) {
        throw new NotFoundException(`CommercialDiagnosis ${id} no encontrada`);
      }

      let approvedBrief: CampaignBriefResponse | null = null;
      if (fresh.campaignBriefId) {
        // Re-accept: la diagnosis ya tenía un brief asociado (por
        // ejemplo, el operador hizo `adjust` después de aceptar y vuelve
        // a aceptar). Recuperamos el brief ya aprobado y NO creamos uno
        // nuevo.
        try {
          approvedBrief = await this.briefs.getById(fresh.campaignBriefId);
          if (approvedBrief.status !== 'APPROVED') {
            approvedBrief = await this.briefs.approve(fresh.campaignBriefId);
          }
        } catch (err) {
          // Si el brief ya no existe, caemos al flujo normal de creación.
          this.logger.warn(
            `Brief ${fresh.campaignBriefId} referenciado por la diagnosis ${id} no existe; creando uno nuevo`,
          );
          approvedBrief = null;
        }
      }

      if (!approvedBrief) {
        // CAS: sólo el primer request que observe `status = READY` gana.
        const cas = await tx.commercialDiagnosis.updateMany({
          where: { id, businessId, status: CommercialDiagnosisStatus.READY },
          data: { status: CommercialDiagnosisStatus.READY },
        });
        // Si count === 0, otro proceso ganó la carrera. Re-leemos para
        // devolver el brief ya creado.
        if (cas.count === 0) {
          const winner = await tx.commercialDiagnosis.findFirst({
            where: { id, businessId },
          });
          if (winner?.campaignBriefId) {
            const existingBrief = await this.briefs.getById(winner.campaignBriefId);
            throw new ConflictException({
              message: 'La diagnosis ya fue aceptada por otra solicitud',
              campaignBrief: existingBrief,
            });
          }
          throw new ConflictException(
            'La diagnosis ya fue aceptada por otra solicitud',
          );
        }

        const createdBrief = await this.briefs.create({
          title: recommendedTitle.slice(0, 120),
          serviceId: primaryService.id,
          businessObjective: strategy.businessObjective,
          offer: strategy.offer,
          primaryKpi: strategy.primaryKpi,
          idealCustomerProfile: strategy.idealCustomerProfile ?? undefined,
          qualifyingQuestions: strategy.qualifyingQuestions,
          constraints: strategy.constraints,
          monthlyAcquisitionGoal:
            recommended.recommendedWeeklyAdd !== null
              ? recommended.recommendedWeeklyAdd * 4
              : undefined,
          costPerAcquisitionCap:
            strategy.initialCpaCapCLP !== null && strategy.initialCpaCapCLP !== undefined
              ? strategy.initialCpaCapCLP
              : undefined,
          lifetimeBudgetCap:
            strategy.initialLifetimeBudgetCLP !== null && strategy.initialLifetimeBudgetCLP !== undefined
              ? strategy.initialLifetimeBudgetCLP
              : undefined,
          dailyBudgetCap:
            strategy.initialDailyBudgetCLP !== null && strategy.initialDailyBudgetCLP !== undefined
              ? strategy.initialDailyBudgetCLP
              : undefined,
          plannedDurationDays: strategy.initialDurationDays,
          stopIf: strategy.stopIf ?? undefined,
          scaleIf: strategy.scaleIf ?? undefined,
        });
        approvedBrief = await this.briefs.approve(createdBrief.id);
      }

      // Marca final de la diagnosis. Aquí seguimos dentro de la tx.
      const updated = await tx.commercialDiagnosis.update({
        where: { id },
        data: {
          status: CommercialDiagnosisStatus.ACCEPTED,
          campaignBriefId: approvedBrief.id,
        },
        include: { answers: true },
      });

      return {
        diagnosis: this.serialize(updated),
        campaignBrief: approvedBrief,
      };
    });
  }

  /**
   * Devuelve la diagnosis si pertenece al negocio activo. Lanza 404 si
   * no existe o si pertenece a otro `businessId`.
   */
  async getById(id: string): Promise<CommercialDiagnosisResponse> {
    const businessId = this.businessId;
    const record = await prisma.commercialDiagnosis.findFirst({
      where: { id, businessId },
      include: { answers: true },
    });
    if (!record) {
      throw new NotFoundException(`CommercialDiagnosis ${id} no encontrada`);
    }
    return this.serialize(record);
  }

  async archive(id: string): Promise<CommercialDiagnosisResponse> {
    const businessId = this.businessId;
    const existing = await this.loadDiagnosis(id, businessId);
    if (existing.status === CommercialDiagnosisStatus.ARCHIVED) {
      return this.serialize(existing);
    }
    const updated = await prisma.commercialDiagnosis.update({
      where: { id },
      data: { status: CommercialDiagnosisStatus.ARCHIVED },
      include: { answers: true },
    });
    return this.serialize(updated);
  }

  // ---------------------------------------------------------------------------
  // Helpers internos: carga de datos
  // ---------------------------------------------------------------------------

  private async loadDiagnosis(
    id: string,
    businessId: string,
  ): Promise<DiagnosisRecord> {
    const record = await prisma.commercialDiagnosis.findFirst({
      where: { id, businessId },
      include: { answers: true },
    });
    if (!record) {
      throw new NotFoundException(`CommercialDiagnosis ${id} no encontrada`);
    }
    return record;
  }

  private async loadServices(
    businessId: string,
    preferredServiceId: string | null,
  ): Promise<ServiceRecord[]> {
    const allActive = await prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
        isActive: true,
      },
    });
    if (!preferredServiceId) return allActive;
    const preferred = allActive.find((service) => service.id === preferredServiceId);
    if (preferred) return [preferred];
    const preferredAny = await prisma.service.findFirst({
      where: { id: preferredServiceId, businessId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
        isActive: true,
      },
    });
    return preferredAny ? [preferredAny, ...allActive] : allActive;
  }

  private async loadServiceForDiagnosis(
    serviceId: string | null,
  ): Promise<ServiceRecord | null> {
    if (!serviceId) return null;
    return prisma.service.findFirst({
      where: { id: serviceId, businessId: this.businessId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
        isActive: true,
      },
    });
  }

  private async buildContext(
    profile: Awaited<ReturnType<BusinessProfileServiceToken['getOrCreate']>>,
    services: ServiceRecord[],
  ): Promise<DiagnosisContext> {
    void profile;
    const resolved = await this.businessProfile.getOrCreate();
    const ctx = this.businessProfile.getBusinessContext(resolved);
    const displayLocation = this.businessProfile.getDisplayLocation(resolved);
    // `evidenceMode` controla si la IA puede proponer Costo por
    // adquisición (CPA) objetivo inicial (sin evidencia histórica).
    // Calculamos la evidencia aquí sólo para conocer el flag; el motor
    // determinista la recalcula con todo el detalle después.
    let evidenceMode: EvidenceMode = 'NO_EVIDENCE';
    let primaryServicePrice: number | null = null;
    try {
      const previewEvidence = await this.evidence.load({
        businessId: resolved.businessId,
        serviceId: services[0]?.id ?? null,
      });
      evidenceMode = previewEvidence.hasEnoughEvidence
        ? 'EVIDENCE'
        : 'NO_EVIDENCE';
    } catch {
      // Si la BD no está disponible en este punto (tests), mantenemos el
      // default `NO_EVIDENCE` para no bloquear el flujo. El servicio
      // seguirá re-evaluando la evidencia en
      // `combineStrategyWithBudgetRecommendation`.
      evidenceMode = 'NO_EVIDENCE';
    }
    const primaryService = services[0];
    if (
      primaryService &&
      primaryService.price !== null &&
      primaryService.price !== undefined
    ) {
      try {
        primaryServicePrice = Number(primaryService.price.toString());
      } catch {
        primaryServicePrice = null;
      }
    }
    return {
      profileReady: this.businessProfile.isReady(resolved),
      primaryCustomerProfile: resolved.primaryCustomerProfile ?? '',
      brandVoiceKeywords: [...(resolved.brandVoiceKeywords ?? [])],
      wordsToAvoid: [...(resolved.wordsToAvoid ?? [])],
      qualifyingQuestions: [...(resolved.qualifyingQuestions ?? [])],
      weeklyServiceCapacity: resolved.weeklyServiceCapacity,
      monthlyAcquisitionGoal: resolved.monthlyAcquisitionGoal,
      costPerAcquisitionCap:
        resolved.costPerAcquisitionCap === null
          ? null
          : Number(resolved.costPerAcquisitionCap.toString()),
      displayLocation,
      communeName: ctx.communeName,
      regionName: ctx.regionName,
      income: ctx.context?.avgHouseholdIncomeCLP ?? null,
      population: ctx.context?.population ?? null,
      profileDescription: ctx.context?.profileDescription ?? null,
      evidenceMode,
      primaryServicePrice,
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        currency: service.currency,
        duration: service.duration,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers internos: invocación del modelo y parsing
  // ---------------------------------------------------------------------------

  private async summarizeWithFallback(
    prompts: ReturnType<typeof buildDiagnosisPrompt>,
    payload: DiagnosisPayload,
    fallback: ParsedDiagnosisDecision,
  ): Promise<ParsedDiagnosisDecision> {
    if (!this.client.isConfigured()) {
      this.logger.warn('OPENAI_CLIENT no configurado; devolviendo fallback determinista');
      return fallback;
    }
    for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
      try {
        const summary = await this.client.summarize(
          payload as unknown as Parameters<OpenAIClientToken['summarize']>[0],
          prompts,
        );
        const parsed = this.parseModelDecision(summary);
        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= MAX_MODEL_ATTEMPTS) {
          this.logger.warn(
            `No se pudo generar diagnóstico con IA, fallback aplicado: ${message}`,
          );
          return fallback;
        }
        this.logger.warn(
          `Reintentando generación de diagnóstico (intento ${attempt}): ${message}`,
        );
      }
    }
    return fallback;
  }

  /**
   * Parser tolerante: acepta variantes razonables del JSON de la IA y
   * devuelve un `ParsedDiagnosisDecision` consistente. Si el JSON no
   * cumple el contrato mínimo (`decision` válido + estructura de
   * `recommended`), lanza `ServiceUnavailableException`.
   *
   * P1-6: después del parseo tolerante, valida el resultado con
   * `OPEN_AI_DECISION_SCHEMA` para descartar valores fuera de rango
   * (presupuestos absurdos, números negativos, strings demasiado
   * largos, etc.). Si el Zod safeParse falla, también descartamos el
   * candidato y aplicamos el fallback determinista desde el caller.
   */
  private parseModelDecision(summary: OpenAISummaryResult): ParsedDiagnosisDecision {
    const candidates = this.collectDecisionCandidates(summary.parsed);
    for (const candidate of candidates) {
      try {
        const decision = this.coerceDecision(candidate);
        if (this.isWithinOpenAiDecisionLimits(decision)) {
          return decision;
        }
        this.logger.warn(
          'Candidato descartado por OPEN_AI_DECISION_SCHEMA: valores fuera de rango',
        );
      } catch (error) {
        this.logger.warn(
          `Candidato de respuesta descartado: ${(error as Error).message}`,
        );
      }
    }
    throw new ServiceUnavailableException(
      'No se pudo consultar OpenAI: respuesta no cumple el formato esperado',
    );
  }

  /**
   * Verifica que el shape producido por el parser tolerante respeta los
   * límites de `OPEN_AI_DECISION_SCHEMA`. La validación final del
   * service (tipos y topes duros) la hace Zod; aquí sólo tenemos que
   * normalizar el shape para que el safeParse acepte las variantes que
   * el parser tolerante ya validó.
   */
  private isWithinOpenAiDecisionLimits(decision: ParsedDiagnosisDecision): boolean {
    const result = OPEN_AI_DECISION_SCHEMA.safeParse(this.toOpenAiDecisionShape(decision));
    return result.success;
  }

  /**
   * Convierte un `ParsedDiagnosisDecision` a la forma exacta que
   * espera `OPEN_AI_DECISION_SCHEMA`. El parser tolerante admite campos
   * extra (no exigidos por el Zod), así que los descartamos al
   * proyectar a este shape reducido.
   */
  private toOpenAiDecisionShape(decision: ParsedDiagnosisDecision): Record<string, unknown> {
    const recommended = decision.recommended;
    const strategy = decision.strategy;
    if (decision.decision === 'READY') {
      return {
        decision: 'READY' as const,
        situation: recommended.situation ?? '',
        opportunity: recommended.opportunity ?? '',
        primaryGoal: recommended.primaryGoal ?? '',
        primaryConversion: recommended.primaryConversion ?? null,
        recommendedTitle: recommended.recommendedTitle ?? '',
        recommendedWeeklyAdd: recommended.recommendedWeeklyAdd ?? null,
        availableCapacity: recommended.availableCapacity ?? null,
        ...(strategy
          ? {
              strategy: {
                businessObjective: strategy.businessObjective,
                offer: strategy.offer,
                primaryKpi: strategy.primaryKpi,
                idealCustomerProfile: strategy.idealCustomerProfile ?? null,
                qualifyingQuestions: strategy.qualifyingQuestions,
                constraints: strategy.constraints,
                stopIf: strategy.stopIf ?? null,
                scaleIf: strategy.scaleIf ?? null,
                initialDailyBudgetCLP: strategy.initialDailyBudgetCLP,
                initialLifetimeBudgetCLP: strategy.initialLifetimeBudgetCLP,
                initialDurationDays: strategy.initialDurationDays,
                initialCpaTargetCLP: strategy.initialCpaTargetCLP ?? null,
                initialCpaCapCLP: strategy.initialCpaCapCLP ?? null,
                cpaRationale: strategy.cpaRationale ?? undefined,
                priceJustification: strategy.priceJustification ?? undefined,
                progressionSteps: strategy.progressionSteps,
              },
            }
          : {}),
      };
    }
    return {
      decision: 'ASK' as const,
      situation: recommended.situation ?? '',
      opportunity: recommended.opportunity ?? null,
      primaryGoal: recommended.primaryGoal ?? null,
      primaryConversion: recommended.primaryConversion ?? null,
      recommendedTitle: recommended.recommendedTitle ?? null,
      recommendedWeeklyAdd: recommended.recommendedWeeklyAdd ?? null,
      availableCapacity: recommended.availableCapacity ?? null,
      pendingQuestion: recommended.pendingQuestion
        ? {
            key: recommended.pendingQuestion.key,
            text: recommended.pendingQuestion.text,
          }
        : { key: '', text: '' },
    };
  }

  private collectDecisionCandidates(
    parsed: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const list: Array<Record<string, unknown>> = [parsed];
    if (parsed['recommended'] && typeof parsed['recommended'] === 'object') {
      const recommended = parsed['recommended'] as Record<string, unknown>;
      const candidate = { ...parsed, recommended };
      list.push(candidate);
    }
    const diagnosis = parsed['diagnosis'];
    if (diagnosis && typeof diagnosis === 'object') {
      list.push(diagnosis as Record<string, unknown>);
    }
    return list;
  }

  private coerceDecision(raw: Record<string, unknown>): ParsedDiagnosisDecision {
    const decisionRaw = this.coerceString(raw['decision'])?.toUpperCase();
    if (decisionRaw !== 'READY' && decisionRaw !== 'ASK') {
      throw new Error('decision inválida o ausente');
    }
    const recommendedRaw =
      (raw['recommended'] && typeof raw['recommended'] === 'object'
        ? (raw['recommended'] as Record<string, unknown>)
        : raw) ?? {};
    const situation = this.coerceString(recommendedRaw['situation']);
    const opportunity = this.coerceString(recommendedRaw['opportunity']);
    const primaryGoal = this.coerceString(recommendedRaw['primaryGoal']);
    const primaryConversion = this.coerceString(recommendedRaw['primaryConversion']);
    const recommendedTitle = this.coerceString(recommendedRaw['recommendedTitle']);
    const recommendedWeeklyAdd = this.coerceInteger(recommendedRaw['recommendedWeeklyAdd']);
    const availableCapacity = this.coerceInteger(recommendedRaw['availableCapacity']);
    const pendingQuestion = this.coercePendingQuestion(
      (recommendedRaw['pendingQuestion'] as Record<string, unknown> | null) ??
        (raw['pendingQuestion'] as Record<string, unknown> | null),
    );

    if (decisionRaw === 'READY') {
      if (!situation || !opportunity || !primaryGoal || !recommendedTitle) {
        throw new Error(
          'READY requiere situation, opportunity, primaryGoal y recommendedTitle no vacíos',
        );
      }
    }

    const provenance = this.coerceProvenance(raw['provenance'], {
      situation,
      opportunity,
      primaryGoal,
      primaryConversion,
      recommendedTitle,
      recommendedWeeklyAdd,
      availableCapacity,
    });
    const strategy = this.coerceStrategy(raw['strategy']);

    return {
      decision: decisionRaw,
      recommended: {
        situation,
        opportunity,
        primaryGoal,
        primaryConversion,
        recommendedTitle,
        recommendedWeeklyAdd,
        availableCapacity,
        pendingQuestion: pendingQuestion ?? null,
      },
      provenance,
      strategy,
    };
  }

  private coerceString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      const str = String(value).trim();
      return str.length > 0 ? str : null;
    }
    return null;
  }

  private coerceInteger(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return null;
  }

  private coercePendingQuestion(
    value: unknown,
  ): { key: string; text: string } | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as Record<string, unknown>;
    const key = this.coerceString(obj['key']);
    const text = this.coerceString(obj['text']);
    if (!key || key.length === 0 || key.length > 80) return null;
    if (!text || text.length === 0 || text.length > 500) return null;
    return { key, text };
  }

  private coerceProvenance(
    value: unknown,
    recommended: {
      situation: string | null;
      opportunity: string | null;
      primaryGoal: string | null;
      primaryConversion: string | null;
      recommendedTitle: string | null;
      recommendedWeeklyAdd: number | null;
      availableCapacity: number | null;
    },
  ): ProvenanceMap {
    const result: ProvenanceMap = {};
    const source =
      value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const fields: Array<{
      key: string;
      value: string | number | null;
    }> = [
      { key: 'situation', value: recommended.situation },
      { key: 'opportunity', value: recommended.opportunity },
      { key: 'primaryGoal', value: recommended.primaryGoal },
      { key: 'primaryConversion', value: recommended.primaryConversion },
      { key: 'recommendedTitle', value: recommended.recommendedTitle },
      { key: 'recommendedWeeklyAdd', value: recommended.recommendedWeeklyAdd },
      { key: 'availableCapacity', value: recommended.availableCapacity },
    ];
    for (const field of fields) {
      const entry = source[field.key];
      const candidate = this.coerceProvenanceEntry(entry);
      if (candidate) {
        result[field.key] = candidate;
      } else {
        result[field.key] = {
          value: field.value,
          source: 'AI_INFERENCE',
        };
      }
    }
    return result;
  }

  private coerceProvenanceEntry(value: unknown): ProvenanceEntry | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as Record<string, unknown>;
    const sourceRaw = this.coerceString(obj['source']);
    const allowed: Array<ProvenanceEntry['source']> = [
      'USER_PROFILE',
      'USER_CURRENT_SITUATION',
      'AI_INFERENCE',
      'SYSTEM_CALCULATION',
      'AI_RECOMMENDATION',
      'CAMPAIGN_OBSERVED_DATA',
    ];
    if (!sourceRaw || !(allowed as string[]).includes(sourceRaw)) return null;
    const valueRaw = obj['value'];
    let normalized: string | number | boolean | null;
    if (valueRaw === null || valueRaw === undefined) {
      normalized = null;
    } else if (
      typeof valueRaw === 'string' ||
      typeof valueRaw === 'number' ||
      typeof valueRaw === 'boolean'
    ) {
      normalized = valueRaw;
    } else {
      normalized = String(valueRaw);
    }
    return {
      value: normalized,
      source: sourceRaw as ProvenanceEntry['source'],
    };
  }

  private coerceStrategy(value: unknown): StrategyShape | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as Record<string, unknown>;
    const businessObjective = this.coerceString(obj['businessObjective']);
    const offer = this.coerceString(obj['offer']);
    const primaryKpi = this.coerceString(obj['primaryKpi']);
    if (!businessObjective || !offer || !primaryKpi) return null;
    const idealCustomerProfile = this.coerceString(obj['idealCustomerProfile']);
    const qualifyingQuestions = this.coerceStringArray(obj['qualifyingQuestions']).slice(0, 20);
    const constraints = this.coerceStringArray(obj['constraints']).slice(0, 20);
    const stopIf = this.coerceString(obj['stopIf']);
    const scaleIf = this.coerceString(obj['scaleIf']);
    const initialDurationDays = this.coerceInteger(obj['initialDurationDays']) ?? 14;
    const initialDailyBudgetCLP = this.coerceFiniteNumber(obj['initialDailyBudgetCLP']);
    const initialLifetimeBudgetCLP = this.coerceFiniteNumber(obj['initialLifetimeBudgetCLP']);
    const initialCpaTargetCLP = this.coerceFiniteNumber(obj['initialCpaTargetCLP']);
    const initialCpaCapCLP = this.coerceFiniteNumber(obj['initialCpaCapCLP']);
    // `cpaRationale` lo entrega la IA en modo NO_EVIDENCE como
    // justificación breve del Costo por adquisición (CPA) objetivo
    // propuesto. Lo limitamos a 200 caracteres para alinear con el tope
    // de cada entrada en `assumptions` (≤200 chars).
    const cpaRationaleRaw = this.coerceString(obj['cpaRationale']);
    const cpaRationale = cpaRationaleRaw === null ? null : cpaRationaleRaw.slice(0, 200);
    const priceJustificationRaw = this.coerceString(obj['priceJustification']);
    // `priceJustification` lo entrega la IA cuando propone un precio
    // objetivo de la oferta distinto al del servicio. Lo limitamos a
    // 200 caracteres para alinear con el resto de strings cortos.
    const priceJustification =
      priceJustificationRaw === null ? null : priceJustificationRaw.slice(0, 200);
    const progressionSteps = this.coerceIntegerArray(obj['progressionSteps']).slice(0, 20);
    const recommendedStartDate = this.coerceDateString(obj['recommendedStartDate']);
    const recommendedEndDate = this.coerceDateString(obj['recommendedEndDate']);
    const recommendedWeekdays = this.coerceWeekdayArray(obj['recommendedWeekdays']);
    const budgetExplanation = this.coerceString(obj['budgetExplanation']);
    const scheduleExplanation = this.coerceString(obj['scheduleExplanation']);
    const assumptions = this.coerceStringArray(obj['assumptions'])
      .map((entry) => entry.slice(0, 200))
      .slice(0, 10);
    const goalAssessment = this.coerceGoalAssessment(obj['goalAssessment']);
    return {
      businessObjective,
      offer,
      primaryKpi,
      idealCustomerProfile,
      qualifyingQuestions,
      constraints,
      stopIf,
      scaleIf,
      initialDailyBudgetCLP,
      initialLifetimeBudgetCLP,
      initialDurationDays,
      initialCpaTargetCLP,
      initialCpaCapCLP,
      cpaRationale,
      priceJustification,
      progressionSteps: progressionSteps.length > 0 ? progressionSteps : [1],
      recommendedStartDate,
      recommendedEndDate,
      recommendedWeekdays,
      budgetExplanation,
      scheduleExplanation,
      assumptions,
      goalAssessment,
    };
  }

  private coerceDateString(value: unknown): string | null {
    const s = this.coerceString(value);
    if (!s) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  private coerceWeekdayArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const out: number[] = [];
    for (const entry of value) {
      const n = this.coerceInteger(entry);
      if (n === null || n < 0 || n > 6) continue;
      out.push(n);
      if (out.length >= 7) break;
    }
    return out;
  }

  private coerceGoalAssessment(
    value: unknown,
  ):
    | { status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA'; explanation: string; disclaimer: string }
    | null {
    if (!value || typeof value !== 'object') return null;
    const obj = value as Record<string, unknown>;
    const status = this.coerceString(obj['status']);
    const explanation = this.coerceString(obj['explanation']);
    const disclaimer = this.coerceString(obj['disclaimer']);
    if (
      (status !== 'SUPPORTED' &&
        status !== 'TESTABLE' &&
        status !== 'UNLIKELY' &&
        status !== 'INSUFFICIENT_DATA') ||
      !explanation ||
      !disclaimer
    ) {
      return null;
    }
    return {
      status,
      explanation: explanation.slice(0, 500),
      disclaimer: disclaimer.slice(0, 500),
    };
  }

  private coerceFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  private coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => this.coerceString(entry))
      .filter((entry): entry is string => entry !== null);
  }

  private coerceIntegerArray(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => this.coerceInteger(entry))
      .filter((entry): entry is number => entry !== null && entry > 0);
  }

  // ---------------------------------------------------------------------------
  // Helpers internos: serialización
  // ---------------------------------------------------------------------------

  private serialize(record: DiagnosisRecord): CommercialDiagnosisResponse {
    const recommended: RecommendedMeta = {
      situation: record.situation,
      opportunity: record.opportunity,
      primaryGoal: record.primaryGoal,
      primaryConversion: record.primaryConversion,
      recommendedTitle: record.recommendedTitle,
      recommendedWeeklyAdd: record.recommendedWeeklyAdd,
      availableCapacity: record.availableCapacity,
    };
    const pending = this.findPendingAnswer(record);
    if (pending) {
      recommended.pendingQuestion = {
        key: pending.questionKey,
        text: pending.questionText,
      };
    }

    const strategy =
      record.status === CommercialDiagnosisStatus.READY ||
      record.status === CommercialDiagnosisStatus.ACCEPTED
        ? this.serializeStrategy(record)
        : undefined;

    return {
      id: record.id,
      businessId: record.businessId,
      status: record.status as CommercialDiagnosisResponse['status'],
      currentSituation: record.currentSituation,
      serviceId: record.serviceId,
      situation: record.situation,
      opportunity: record.opportunity,
      primaryGoal: record.primaryGoal,
      primaryConversion: record.primaryConversion,
      recommendedTitle: record.recommendedTitle,
      recommendedWeeklyAdd: record.recommendedWeeklyAdd,
      availableCapacity: record.availableCapacity,
      recommended,
      strategy,
      answers: record.answers
        .slice()
        .sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime())
        .map((answer) => ({
          id: answer.id,
          questionKey: answer.questionKey,
          questionText: answer.questionText,
          answerText: answer.answerText,
          askedAt: answer.askedAt.toISOString(),
          answeredAt:
            answer.answeredAt === null ? null : answer.answeredAt.toISOString(),
        })),
      campaignBriefId: record.campaignBriefId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private serializeStrategy(
    record: CommercialDiagnosis,
  ): CommercialDiagnosisResponse['strategy'] {
    const provenance = (record.provenance as unknown as ProvenanceMap) ?? {};
    return {
      businessObjective: record.businessObjective ?? '',
      offer: record.offer ?? '',
      primaryKpi: record.primaryKpi ?? '',
      idealCustomerProfile: record.idealCustomerProfile,
      // P1-Hallazgo 5: filtramos los marcadores internos
      // (`__priceJustification__:`) del array `qualifyingQuestions`
      // antes de exponerlo. La justificación del precio va en su propio
      // campo `priceJustification`.
      qualifyingQuestions: stripInternalQualifyingMarkers([
        ...(record.qualifyingQuestions ?? []),
      ]),
      constraints: [...(record.constraints ?? [])],
      stopIf: record.stopIf,
      scaleIf: record.scaleIf,
      initialDailyBudgetCLP:
        record.initialDailyBudgetCLP === null
          ? null
          : record.initialDailyBudgetCLP.toString(),
      initialLifetimeBudgetCLP:
        record.initialLifetimeBudgetCLP === null
          ? null
          : record.initialLifetimeBudgetCLP.toString(),
      initialDurationDays: record.initialDurationDays ?? 14,
      initialCpaTargetCLP:
        record.initialCpaTargetCLP === null
          ? null
          : record.initialCpaTargetCLP.toString(),
      initialCpaCapCLP:
        record.initialCpaCapCLP === null
          ? null
          : record.initialCpaCapCLP.toString(),
      cpaRationale: this.extractCpaRationale(record),
      // P1-Hallazgo 5: exponemos `priceJustification` siempre
      // (decodificado de `qualifyingQuestions`).
      priceJustification: this.extractPriceJustification(record),
      progressionSteps: [...(record.progressionSteps ?? [])],
      recommendedStartDate:
        record.recommendedStartDate === null || record.recommendedStartDate === undefined
          ? null
          : toIsoDate(record.recommendedStartDate),
      recommendedEndDate:
        record.recommendedEndDate === null || record.recommendedEndDate === undefined
          ? null
          : toIsoDate(record.recommendedEndDate),
      recommendedWeekdays: [...(record.recommendedWeekdays ?? [])],
      budgetExplanation: record.budgetExplanation,
      scheduleExplanation: record.scheduleExplanation,
      // P1-Hallazgo 4: filtramos los marcadores internos
      // (`__cpaRationale__:` y `__priceJustification__:`) del array
      // público `assumptions`. El rationale va en su propio campo
      // `cpaRationale`.
      assumptions: stripInternalAssumptionMarkers([...(record.assumptions ?? [])]),
      goalAssessment:
        record.goalAssessment === null || record.goalAssessment === undefined
          ? null
          : (record.goalAssessment as {
              status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA';
              explanation: string;
              disclaimer: string;
            }),
      provenance,
    };
  }

  /**
   * Decodifica la justificación del Costo por adquisición (CPA) objetivo
   * propuesta por la IA. Como `CommercialDiagnosis` no tiene columna
   * propia todavía, persistimos la justificación en `assumptions[0]`
   * cuando viene precedida por el prefijo `__cpaRationale__:` (ver
   * `combineStrategyWithBudgetRecommendation`). Esto evita una migración
   * y mantiene la justificación recuperable por la UI. Si el registro
   * no contiene la marca (por ejemplo, una fila legacy), devolvemos
   * `null`.
   */
  private extractCpaRationale(record: CommercialDiagnosis): string | null {
    const assumptions = [...(record.assumptions ?? [])];
    for (const entry of assumptions) {
      if (entry.startsWith('__cpaRationale__:')) {
        return entry.slice('__cpaRationale__:'.length).trim() || null;
      }
    }
    return null;
  }

  /**
   * Decodifica la justificación del precio objetivo de la oferta.
   * `CommercialDiagnosis` no tiene columna propia: la persistimos
   * codificada en `qualifyingQuestions` con el prefijo
   * `__priceJustification__:` (ver `persistPriceJustification`). Si el
   * registro no contiene la marca (por ejemplo, una fila legacy),
   * devolvemos `null`.
   */
  private extractPriceJustification(record: CommercialDiagnosis): string | null {
    const questions = [...(record.qualifyingQuestions ?? [])];
    for (const entry of questions) {
      if (entry.startsWith('__priceJustification__:')) {
        return entry.slice('__priceJustification__:'.length).trim() || null;
      }
    }
    return null;
  }

  private recommendedFromRecord(record: CommercialDiagnosis): {
    situation: string | null;
    opportunity: string | null;
    primaryGoal: string | null;
    primaryConversion: string | null;
    recommendedTitle: string | null;
    recommendedWeeklyAdd: number | null;
    availableCapacity: number | null;
  } {
    return {
      situation: record.situation,
      opportunity: record.opportunity,
      primaryGoal: record.primaryGoal,
      primaryConversion: record.primaryConversion,
      recommendedTitle: record.recommendedTitle,
      recommendedWeeklyAdd: record.recommendedWeeklyAdd,
      availableCapacity: record.availableCapacity,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers internos: fallback determinista
  // ---------------------------------------------------------------------------

  private buildFallback(
    payload: DiagnosisPayload,
    source: ProvenanceEntry['source'],
  ): ParsedDiagnosisDecision {
    const situation = this.buildFallbackSituation(payload);
    const opportunity = this.buildFallbackOpportunity(payload);
    const primaryGoal = this.buildFallbackPrimaryGoal(payload);
    const primaryConversion =
      payload.context.primaryCustomerProfile.toLowerCase().includes('whatsapp')
        ? 'Leads por WhatsApp'
        : 'Reservas';
    const service = payload.context.services[0];
    const recommendedTitle = service
      ? `Plan para ${service.name}`
      : RECOMMENDED_FALLBACK_TITLE;
    const recommendedWeeklyAdd = this.buildFallbackWeeklyAdd(payload);
    const availableCapacity = payload.context.weeklyServiceCapacity;

    const strategy = this.buildFallbackStrategy(payload, primaryGoal, primaryConversion);

    const provenance: ProvenanceMap = {
      situation: { value: situation, source },
      opportunity: { value: opportunity, source: 'AI_INFERENCE' },
      primaryGoal: { value: primaryGoal, source: 'AI_INFERENCE' },
      primaryConversion: { value: primaryConversion, source: source === 'SYSTEM_CALCULATION' ? 'AI_INFERENCE' : source },
      recommendedTitle: { value: recommendedTitle, source: 'SYSTEM_CALCULATION' },
      recommendedWeeklyAdd: {
        value: recommendedWeeklyAdd,
        source: 'SYSTEM_CALCULATION',
      },
      availableCapacity: {
        value: availableCapacity,
        source: 'USER_PROFILE',
      },
    };

    return {
      decision: 'READY',
      recommended: {
        situation,
        opportunity,
        primaryGoal,
        primaryConversion,
        recommendedTitle,
        recommendedWeeklyAdd,
        availableCapacity,
        pendingQuestion: null,
      },
      provenance,
      strategy,
    };
  }

  private buildFallbackSituation(payload: DiagnosisPayload): string {
    const trimmed = payload.currentSituation.trim();
    const truncated =
      trimmed.length > 200 ? `${trimmed.slice(0, 200).trim()}…` : trimmed;
    return `Situación declarada por la operadora: ${truncated}`;
  }

  private buildFallbackOpportunity(payload: DiagnosisPayload): string {
    const service = payload.context.services[0];
    if (!service) {
      return 'No se identificó un servicio activo en el negocio.';
    }
    const description = service.description ? ` (${service.description})` : '';
    return `Oportunidad detectada en el servicio principal "${service.name}"${description}.`;
  }

  private buildFallbackPrimaryGoal(payload: DiagnosisPayload): string {
    const capacity = payload.context.weeklyServiceCapacity;
    if (capacity && capacity > 0) {
      return `Conseguir ${capacity} clientes nuevos por semana para llenar la capacidad registrada en el perfil.`;
    }
    const service = payload.context.services[0];
    if (service) {
      return `Aumentar las reservas del servicio "${service.name}" durante las próximas 2 semanas.`;
    }
    return 'Aumentar las reservas del negocio durante las próximas 2 semanas.';
  }

  private buildFallbackWeeklyAdd(payload: DiagnosisPayload): number | null {
    const capacity = payload.context.weeklyServiceCapacity;
    if (capacity && capacity > 0) return capacity;
    return null;
  }

  private buildFallbackStrategy(
    payload: DiagnosisPayload,
    primaryGoal: string,
    primaryConversion: string,
  ): StrategyShape {
    const profile = payload.context;
    const offer = RECOMMENDED_FALLBACK_OFFER;
    const constraints =
      profile.wordsToAvoid.length > 0
        ? [`No usar ${profile.wordsToAvoid.join(', ')}`]
        : [];
    const progression =
      profile.weeklyServiceCapacity && profile.weeklyServiceCapacity > 0
        ? [profile.weeklyServiceCapacity]
        : [3, 4, 5, 6];
    return {
      businessObjective: primaryGoal.slice(0, 1000),
      offer,
      primaryKpi: primaryConversion,
      idealCustomerProfile: profile.primaryCustomerProfile || null,
      qualifyingQuestions: profile.qualifyingQuestions.slice(0, 20),
      constraints,
      stopIf: null,
      scaleIf: null,
      initialDailyBudgetCLP: null,
      initialLifetimeBudgetCLP: null,
      initialDurationDays: 14,
      initialCpaTargetCLP: null,
      initialCpaCapCLP: profile.costPerAcquisitionCap,
      // El fallback NO propone CPA objetivo: en modo INSUFFICIENT_DATA
      // el motor determinista devuelve la rama correspondiente. La UI
      // muestra `null` hasta que la IA pueda proponer uno (en
      // `NO_EVIDENCE`) o hasta que haya evidencia histórica.
      cpaRationale: null,
      priceJustification: null,
      progressionSteps: progression,
      recommendedStartDate: null,
      recommendedEndDate: null,
      recommendedWeekdays: [],
      budgetExplanation: null,
      scheduleExplanation: null,
      assumptions: [],
      goalAssessment: null,
    };
  }

  private buildStrategyFromRecord(
    record: CommercialDiagnosis,
    profile: Awaited<ReturnType<BusinessProfileServiceToken['getOrCreate']>>,
  ): StrategyShape {
    const businessObjective =
      (record.businessObjective ?? '').trim() ||
      record.primaryGoal ||
      'Aumentar las reservas del negocio';
    const offer = (record.offer ?? '').trim() || RECOMMENDED_FALLBACK_OFFER;
    const primaryKpi = (record.primaryKpi ?? '').trim() || record.primaryConversion || 'Reservas';
    const qualifyingQuestions = stripInternalQualifyingMarkers([
      ...(record.qualifyingQuestions ?? []),
      ...(profile.qualifyingQuestions ?? []),
    ])
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 20);
    const constraints = [...(record.constraints ?? [])]
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 20);
    const progressionSteps = (record.progressionSteps ?? []).filter(
      (entry) => typeof entry === 'number' && entry > 0,
    );
    return {
      businessObjective: businessObjective.slice(0, 1000),
      offer: offer.slice(0, 1000),
      primaryKpi: primaryKpi.slice(0, 80),
      idealCustomerProfile: record.idealCustomerProfile ?? null,
      qualifyingQuestions,
      constraints,
      stopIf: record.stopIf,
      scaleIf: record.scaleIf,
      initialDailyBudgetCLP:
        record.initialDailyBudgetCLP === null
          ? null
          : Number(record.initialDailyBudgetCLP.toString()),
      initialLifetimeBudgetCLP:
        record.initialLifetimeBudgetCLP === null
          ? null
          : Number(record.initialLifetimeBudgetCLP.toString()),
      initialDurationDays: record.initialDurationDays ?? 14,
      initialCpaTargetCLP:
        record.initialCpaTargetCLP === null
          ? null
          : Number(record.initialCpaTargetCLP.toString()),
      initialCpaCapCLP:
        record.initialCpaCapCLP === null
          ? null
          : Number(record.initialCpaCapCLP.toString()),
      cpaRationale: this.extractCpaRationale(record),
      // P1-Hallazgo 5: leemos `priceJustification` desde el registro
      // (decodificado del prefijo en `qualifyingQuestions`).
      priceJustification: this.extractPriceJustification(record),
      progressionSteps: progressionSteps.length > 0 ? progressionSteps : [1],
      recommendedStartDate:
        record.recommendedStartDate === null || record.recommendedStartDate === undefined
          ? null
          : toIsoDate(record.recommendedStartDate),
      recommendedEndDate:
        record.recommendedEndDate === null || record.recommendedEndDate === undefined
          ? null
          : toIsoDate(record.recommendedEndDate),
      recommendedWeekdays: [...(record.recommendedWeekdays ?? [])],
      budgetExplanation: record.budgetExplanation ?? null,
      scheduleExplanation: record.scheduleExplanation ?? null,
      // P1-Hallazgo 4: filtramos marcadores del array público.
      assumptions: stripInternalAssumptionMarkers([...(record.assumptions ?? [])]),
      goalAssessment:
        record.goalAssessment === null || record.goalAssessment === undefined
          ? null
          : (record.goalAssessment as {
              status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA';
              explanation: string;
              disclaimer: string;
            }),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers internos: utilidades varias
  // ---------------------------------------------------------------------------

  private findPendingAnswer(
    record: DiagnosisRecord,
  ): DiagnosticAnswer | null {
    const sorted = [...record.answers].sort(
      (a, b) => a.askedAt.getTime() - b.askedAt.getTime(),
    );
    for (const answer of sorted) {
      if (answer.answeredAt === null) {
        return answer;
      }
    }
    return null;
  }

  private buildConversationFromAnswers(
    answers: DiagnosticAnswer[],
    overrideAnsweredAt: Date | null,
    overrideLastEntry: {
      questionKey: string;
      questionText: string;
      answerText: string;
    } | null,
  ): DiagnosticConversationEntry[] {
    const sorted = [...answers].sort(
      (a, b) => a.askedAt.getTime() - b.askedAt.getTime(),
    );
    return sorted.map((answer, index) => {
      const isLast = index === sorted.length - 1;
      const answerText =
        overrideLastEntry && isLast
          ? overrideLastEntry.answerText
          : answer.answerText;
      const answeredAt = overrideAnsweredAt && isLast ? overrideAnsweredAt : answer.answeredAt;
      return {
        questionKey: answer.questionKey,
        questionText: answer.questionText,
        answerText:
          answeredAt === null || answerText === null || answerText === undefined
            ? null
            : answerText,
        wasClarification: answer.wasClarification,
      };
    });
  }

  private isPendingQuestionValid(
    pending: { key: string; text: string } | null,
  ): boolean {
    if (!pending) return false;
    if (pending.key.length === 0 || pending.key.length > 80) return false;
    if (pending.text.length === 0 || pending.text.length > 500) return false;
    return true;
  }


  /**
   * Tipo de entrada para `combineStrategyWithBudgetRecommendation`.
   * Se compone de la decisión cruda de la IA (o del fallback) y los
   * argumentos que necesita el motor determinista para producir la
   * recomendación final.
   *
   * Rangos admitidos para que la IA sobrescriba el motor (clamp final
   * antes de persistir — fuera de estos rangos se descarta y se usa el
   * valor del motor):
   *  - `dailyBudget`: [1_000, 1_000_000] CLP/día.
   *  - `lifetimeBudget`: [1_000, 1_000_000] CLP/día × duración (calculado
   *    como `dailyBudget × durationDays`).
   *  - `durationDays`: [7, 21].
   *  - `cpaTarget`: [1, 1_000_000] CLP.
   *  - `cpaCap`: [1, 1_000_000] CLP, mayor o igual al cpaTarget.
   *
   * Si el motor devuelve `null` (modo INSUFFICIENT_DATA), persiste null
   * aunque la IA haya propuesto algo — la IA nunca "rellena" lo que el
   * motor rechazó.
   */
  private async combineStrategyWithBudgetRecommendation(args: {
    businessId: string;
    serviceId: string | null;
    weeklyAdd: number | null;
    capacity: number | null;
    cpaTarget: number | null;
    cpaCap: number | null;
    cpaRationale: string | null;
    initial: {
      initialDailyBudgetCLP: number | null;
      initialLifetimeBudgetCLP: number | null;
      initialDurationDays: number;
      initialCpaTargetCLP: number | null;
      initialCpaCapCLP: number | null;
      recommendedStartDate: string | null;
      recommendedEndDate: string | null;
      recommendedWeekdays: number[];
      budgetExplanation: string | null;
      scheduleExplanation: string | null;
      assumptions: string[];
      goalAssessment:
        | { status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA'; explanation: string; disclaimer: string }
        | null;
    };
  }): Promise<{
    initialDailyBudgetCLP: number | null;
    initialLifetimeBudgetCLP: number | null;
    initialDurationDays: number;
    initialCpaTargetCLP: number | null;
    initialCpaCapCLP: number | null;
    /**
     * CPA objetivo efectivo que el motor usó. En modo EVIDENCE es el
     * `evidence.averageCpa`; en modo TESTABLE es el propuesto por la IA
     * (o `null` si la IA no lo propuso). Se devuelve explícito para que
     * el caller lo persista en `initialCpaTargetCLP` aunque difiera del
     * que la IA propuso (caso EVIDENCE).
     */
    effectiveCpaTarget: number | null;
    effectiveCpaCap: number | null;
    recommendedStartDate: string;
    recommendedEndDate: string;
    recommendedWeekdays: number[];
    budgetExplanation: string;
    scheduleExplanation: string;
    assumptions: string[];
    goalAssessment: { status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA'; explanation: string; disclaimer: string };
  }> {
    const evidence = await this.evidence.load({
      businessId: args.businessId,
      serviceId: args.serviceId,
    });
    // P1-Hallazgo 1: pasamos `durationDays` desde la decisión cruda al
    // motor para que el clamp interno (`[7, 21]`) se aplique. Antes,
    // el orquestador llamaba al motor sin duración y luego
    // sobrescribía el resultado con valores de la IA que podían caer
    // fuera de los rangos válidos. Pasamos el valor tal cual: el
    // motor hace el clamp final (365 → 21, 4 → 7, etc.).
    const recommendation = this.budgetRecommendation.recommend({
      weeklyAdd: args.weeklyAdd,
      capacity: args.capacity,
      cpaTarget: args.cpaTarget,
      cpaCap: args.cpaCap,
      evidence,
      durationDays: args.initial.initialDurationDays,
      now: new Date(),
    });
    // P1-Hallazgo 1: el motor es autoritativo. La IA sólo puede
    // sobrescribir un valor cuando lo entregó DENTRO del rango del
    // clamp del motor. Si lo propuso fuera de rango, lo ignoramos y
    // usamos el del motor (que ya está clamped).
    //
    // Si el motor devuelve `null` (INSUFFICIENT_DATA), persiste null
    // aunque la IA haya propuesto algo — la IA nunca rellena lo que el
    // motor rechazó.
    const DAILY_MIN = 1_000;
    const DAILY_MAX = 1_000_000;
    const DURATION_MIN = 7;
    const DURATION_MAX = 21;
    const CPA_MIN = 1;
    const CPA_MAX = 1_000_000;
    const dailyBudget =
      recommendation.dailyBudget === null
        ? null
        : args.initial.initialDailyBudgetCLP !== null &&
            args.initial.initialDailyBudgetCLP >= DAILY_MIN &&
            args.initial.initialDailyBudgetCLP <= DAILY_MAX
          ? args.initial.initialDailyBudgetCLP
          : recommendation.dailyBudget;
    // El lifetime del motor ya viene cuadrado con el daily final cuando
    // hay clamp; sólo permitimos override si la IA lo entrega dentro
    // del rango Y consistente con su propio daily.
    const lifetimeBudget =
      recommendation.lifetimeBudget === null
        ? null
        : args.initial.initialLifetimeBudgetCLP !== null &&
            args.initial.initialLifetimeBudgetCLP >= DAILY_MIN &&
            args.initial.initialLifetimeBudgetCLP <= DAILY_MAX * DURATION_MAX
          ? args.initial.initialLifetimeBudgetCLP
          : recommendation.lifetimeBudget;
    const durationDays =
      args.initial.initialDurationDays >= DURATION_MIN &&
      args.initial.initialDurationDays <= DURATION_MAX
        ? args.initial.initialDurationDays
        : recommendation.durationDays;
    // El CPA objetivo efectivo lo fija el motor:
    //  - En modo EVIDENCE es `evidence.averageCpa` (no se respeta lo
    //    que la IA propuso — el histórico manda).
    //  - En modo TESTABLE es el propuesto por la IA (o `null` si no
    //    llegó).
    // Detectamos TESTABLE viendo que `recommendation.cpaTarget` coincide
    // con el input de la IA: si difiere, el motor lo sobrescribió (modo
    // EVIDENCE) y descartamos el valor de la IA. Si coincide, la IA
    // puede refinar su valor dentro del rango.
    const iaProposedCpaTarget = args.initial.initialCpaTargetCLP;
    const persistedCpaTarget =
      recommendation.cpaTarget === null
        ? null
        : iaProposedCpaTarget !== null &&
            iaProposedCpaTarget >= CPA_MIN &&
            iaProposedCpaTarget <= CPA_MAX &&
            // El motor aceptó el valor de la IA (modo TESTABLE).
            recommendation.cpaTarget === iaProposedCpaTarget
          ? iaProposedCpaTarget
          : recommendation.cpaTarget;
    // El CPA tope: la IA lo puede proponer, pero sólo si es positivo,
    // ≤ CPA_MAX y mayor o igual al CPA objetivo final (para no
    // contradecir la regla "tope ≥ objetivo").
    const persistedCpaCap =
      args.initial.initialCpaCapCLP !== null &&
      args.initial.initialCpaCapCLP >= CPA_MIN &&
      args.initial.initialCpaCapCLP <= CPA_MAX &&
      (persistedCpaTarget === null || args.initial.initialCpaCapCLP >= persistedCpaTarget)
        ? args.initial.initialCpaCapCLP
        : recommendation.cpaCap;
    /**
     * P1-Hallazgo 4: persistencia del `cpaRationale` y merge de assumptions.
     *
     * `CommercialDiagnosis` no tiene columna propia todavía. Para no
     * requerir migración, guardamos la justificación codificada en la
     * primera entrada de `assumptions` con el prefijo
     * `__cpaRationale__:`. La deserialización ocurre en
     * `extractCpaRationale` y en el serializer se filtra el marcador
     * antes de devolver el array `assumptions` (mantiene el contrato
     * público: `cpaRationale` como string separado, `assumptions` sin
     * prefijos internos).
     *
     * Reglas de merge (sin `slice(0, 10)` que truncaba assumptions reales):
     *  - IA entrega `cpaRationale` y el motor entrega assumptions: el
     *    rationale va primero con el marcador, luego las assumptions
     *    del motor deduplicadas contra las de la IA (preservando orden).
     *  - IA entrega `cpaRationale` pero no assumptions: usamos las
     *    del motor (sin dedup adicional).
     *  - IA no entrega `cpaRationale`: usamos sus assumptions, o las del
     *    motor si la IA tampoco entregó.
     */
    const iaAssumptions = args.initial.assumptions;
    const motorAssumptions = recommendation.assumptions;
    const cpaRationale = args.cpaRationale;
    const seen = new Set<string>();
    const merged: string[] = [];
    if (cpaRationale !== null && cpaRationale.length > 0) {
      // Marcador SIEMPRE primero para que `extractCpaRationale` lo
      // encuentre al inicio (escaneo lineal en decode).
      merged.push(`__cpaRationale__:${cpaRationale}`);
      seen.add(`__cpaRationale__:${cpaRationale}`);
    }
    for (const entry of iaAssumptions) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      merged.push(entry);
    }
    for (const entry of motorAssumptions) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      merged.push(entry);
    }
    return {
      initialDailyBudgetCLP: dailyBudget,
      initialLifetimeBudgetCLP: lifetimeBudget,
      initialDurationDays: durationDays,
      initialCpaTargetCLP: persistedCpaTarget,
      initialCpaCapCLP: persistedCpaCap,
      effectiveCpaTarget: persistedCpaTarget,
      effectiveCpaCap: persistedCpaCap,
      recommendedStartDate: args.initial.recommendedStartDate ?? recommendation.recommendedStartDate,
      recommendedEndDate: args.initial.recommendedEndDate ?? recommendation.recommendedEndDate,
      recommendedWeekdays:
        args.initial.recommendedWeekdays.length > 0
          ? args.initial.recommendedWeekdays
          : recommendation.recommendedWeekdays,
      budgetExplanation: args.initial.budgetExplanation ?? recommendation.budgetExplanation,
      scheduleExplanation: args.initial.scheduleExplanation ?? recommendation.scheduleExplanation,
      assumptions: merged,
      goalAssessment: args.initial.goalAssessment ?? recommendation.goalAssessment,
    };
  }


  /**
   * Construye el bloque `data` que se persiste en `CommercialDiagnosis`
   * cuando la decisión es READY: combina la strategy de la IA (o del
   * fallback) con la recomendación determinista del motor, y los traduce
   * a los `Decimal`/`Date`/arrays/`Json` que Prisma espera.
   */

  /**
   * Equivalente a `buildStrategyUpdateData` pero compatible con
   `prisma.commercialDiagnosis.create` (que no admite operadores como
   `NullableStringFieldUpdateOperationsInput`). Devuelve los mismos
   valores escalares que `buildStrategyUpdateData`, sólo en el shape de
   create.
   */
  private async buildStrategyCreateData(
    businessId: string,
    serviceId: string | null,
    decision: ParsedDiagnosisDecision,
  ): Promise<Partial<Prisma.CommercialDiagnosisUncheckedCreateInput>> {
    const strategy = decision.strategy;
    const combined = await this.combineStrategyWithBudgetRecommendation({
      businessId,
      serviceId,
      weeklyAdd: decision.recommended.recommendedWeeklyAdd,
      capacity: decision.recommended.availableCapacity,
      cpaTarget: strategy?.initialCpaTargetCLP ?? null,
      cpaCap: strategy?.initialCpaCapCLP ?? null,
      cpaRationale: strategy?.cpaRationale ?? null,
      initial: {
        initialDailyBudgetCLP: strategy?.initialDailyBudgetCLP ?? null,
        initialLifetimeBudgetCLP: strategy?.initialLifetimeBudgetCLP ?? null,
        initialDurationDays: strategy?.initialDurationDays ?? 14,
        initialCpaTargetCLP: strategy?.initialCpaTargetCLP ?? null,
        initialCpaCapCLP: strategy?.initialCpaCapCLP ?? null,
        recommendedStartDate: strategy?.recommendedStartDate ?? null,
        recommendedEndDate: strategy?.recommendedEndDate ?? null,
        recommendedWeekdays: strategy?.recommendedWeekdays ?? [],
        budgetExplanation: strategy?.budgetExplanation ?? null,
        scheduleExplanation: strategy?.scheduleExplanation ?? null,
        assumptions: strategy?.assumptions ?? [],
        goalAssessment: strategy?.goalAssessment ?? null,
      },
    });
    // P1-Hallazgo 5: persistimos `priceJustification` codificado en
    // `qualifyingQuestions` con el prefijo `__priceJustification__:` para
    // no requerir migración. La deserialización ocurre en
    // `extractPriceJustification` y el prefijo se filtra al serializar.
    const qualifyingQuestionsPersisted = persistPriceJustification(
      strategy?.qualifyingQuestions ?? [],
      strategy?.priceJustification ?? null,
    );
    const data: Partial<Prisma.CommercialDiagnosisUncheckedCreateInput> = {
      businessObjective: strategy?.businessObjective ?? null,
      offer: strategy?.offer ?? null,
      primaryKpi: strategy?.primaryKpi ?? null,
      idealCustomerProfile: strategy?.idealCustomerProfile ?? null,
      qualifyingQuestions: qualifyingQuestionsPersisted,
      constraints: strategy?.constraints ?? [],
      stopIf: strategy?.stopIf ?? null,
      scaleIf: strategy?.scaleIf ?? null,
      initialDailyBudgetCLP:
        combined.initialDailyBudgetCLP !== null && combined.initialDailyBudgetCLP !== undefined
          ? new Prisma.Decimal(combined.initialDailyBudgetCLP)
          : null,
      initialLifetimeBudgetCLP:
        combined.initialLifetimeBudgetCLP !== null && combined.initialLifetimeBudgetCLP !== undefined
          ? new Prisma.Decimal(combined.initialLifetimeBudgetCLP)
          : null,
      initialDurationDays: combined.initialDurationDays,
      initialCpaTargetCLP:
        combined.initialCpaTargetCLP !== null && combined.initialCpaTargetCLP !== undefined
          ? new Prisma.Decimal(combined.initialCpaTargetCLP)
          : null,
      initialCpaCapCLP:
        combined.initialCpaCapCLP !== null && combined.initialCpaCapCLP !== undefined
          ? new Prisma.Decimal(combined.initialCpaCapCLP)
          : null,
      progressionSteps: strategy?.progressionSteps ?? [],
      recommendedStartDate: new Date(`${combined.recommendedStartDate}T00:00:00.000Z`),
      recommendedEndDate: new Date(`${combined.recommendedEndDate}T00:00:00.000Z`),
      recommendedWeekdays: combined.recommendedWeekdays,
      budgetExplanation: combined.budgetExplanation,
      scheduleExplanation: combined.scheduleExplanation,
      assumptions: combined.assumptions,
      goalAssessment: combined.goalAssessment as PrismaTypes.InputJsonValue,
    };
    return data;
  }

  private async buildStrategyUpdateData(
    businessId: string,
    serviceId: string | null,
    decision: ParsedDiagnosisDecision,
  ): Promise<Prisma.CommercialDiagnosisUpdateInput> {
    const strategy = decision.strategy;
    const combined = await this.combineStrategyWithBudgetRecommendation({
      businessId,
      serviceId,
      weeklyAdd: decision.recommended.recommendedWeeklyAdd,
      capacity: decision.recommended.availableCapacity,
      cpaTarget: strategy?.initialCpaTargetCLP ?? null,
      cpaCap: strategy?.initialCpaCapCLP ?? null,
      cpaRationale: strategy?.cpaRationale ?? null,
      initial: {
        initialDailyBudgetCLP: strategy?.initialDailyBudgetCLP ?? null,
        initialLifetimeBudgetCLP: strategy?.initialLifetimeBudgetCLP ?? null,
        initialDurationDays: strategy?.initialDurationDays ?? 14,
        initialCpaTargetCLP: strategy?.initialCpaTargetCLP ?? null,
        initialCpaCapCLP: strategy?.initialCpaCapCLP ?? null,
        recommendedStartDate: strategy?.recommendedStartDate ?? null,
        recommendedEndDate: strategy?.recommendedEndDate ?? null,
        recommendedWeekdays: strategy?.recommendedWeekdays ?? [],
        budgetExplanation: strategy?.budgetExplanation ?? null,
        scheduleExplanation: strategy?.scheduleExplanation ?? null,
        assumptions: strategy?.assumptions ?? [],
        goalAssessment: strategy?.goalAssessment ?? null,
      },
    });
    // P1-Hallazgo 5: ver `buildStrategyCreateData`. Codificamos
    // `priceJustification` con el prefijo `__priceJustification__:`.
    const qualifyingQuestionsPersisted = persistPriceJustification(
      strategy?.qualifyingQuestions ?? [],
      strategy?.priceJustification ?? null,
    );
    const data: Partial<Prisma.CommercialDiagnosisUpdateInput> = {
      businessObjective: strategy?.businessObjective ?? null,
      offer: strategy?.offer ?? null,
      primaryKpi: strategy?.primaryKpi ?? null,
      idealCustomerProfile: strategy?.idealCustomerProfile ?? null,
      qualifyingQuestions: qualifyingQuestionsPersisted,
      constraints: strategy?.constraints ?? [],
      stopIf: strategy?.stopIf ?? null,
      scaleIf: strategy?.scaleIf ?? null,
      initialDailyBudgetCLP:
        combined.initialDailyBudgetCLP !== null && combined.initialDailyBudgetCLP !== undefined
          ? new Prisma.Decimal(combined.initialDailyBudgetCLP)
          : null,
      initialLifetimeBudgetCLP:
        combined.initialLifetimeBudgetCLP !== null && combined.initialLifetimeBudgetCLP !== undefined
          ? new Prisma.Decimal(combined.initialLifetimeBudgetCLP)
          : null,
      initialDurationDays: combined.initialDurationDays,
      initialCpaTargetCLP:
        combined.initialCpaTargetCLP !== null && combined.initialCpaTargetCLP !== undefined
          ? new Prisma.Decimal(combined.initialCpaTargetCLP)
          : null,
      initialCpaCapCLP:
        combined.initialCpaCapCLP !== null && combined.initialCpaCapCLP !== undefined
          ? new Prisma.Decimal(combined.initialCpaCapCLP)
          : null,
      progressionSteps: strategy?.progressionSteps ?? [],
      recommendedStartDate: new Date(`${combined.recommendedStartDate}T00:00:00.000Z`),
      recommendedEndDate: new Date(`${combined.recommendedEndDate}T00:00:00.000Z`),
      recommendedWeekdays: combined.recommendedWeekdays,
      budgetExplanation: combined.budgetExplanation,
      scheduleExplanation: combined.scheduleExplanation,
      assumptions: combined.assumptions,
      goalAssessment: combined.goalAssessment as PrismaTypes.InputJsonValue,
    };
    return data;
  }

  private isReadyValid(decision: ParsedDiagnosisDecision): boolean {
    const r = decision.recommended;
    return Boolean(
      decision.decision === 'READY' &&
        r.situation &&
        r.opportunity &&
        r.primaryGoal &&
        r.recommendedTitle,
    );
  }

  private columnForField(field: keyof RecommendedMeta): string {
    const map: Record<keyof RecommendedMeta, string> = {
      situation: 'situation',
      opportunity: 'opportunity',
      primaryGoal: 'primaryGoal',
      primaryConversion: 'primaryConversion',
      recommendedTitle: 'recommendedTitle',
      recommendedWeeklyAdd: 'recommendedWeeklyAdd',
      availableCapacity: 'availableCapacity',
      pendingQuestion: 'pendingQuestion',
    };
    return map[field];
  }

  private valuesDiffer(
    a: string | number | boolean | null | undefined,
    b: unknown,
  ): boolean {
    if (a === null || a === undefined) return b !== null && b !== undefined;
    if (typeof b === 'number' || typeof b === 'boolean' || typeof b === 'string') {
      return a !== b;
    }
    if (b === null || b === undefined) return true;
    return String(a) !== String(b);
  }

  private normalizeProvenanceValue(
    value: unknown,
  ): string | number | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
      return value;
    }
    return String(value);
  }
}