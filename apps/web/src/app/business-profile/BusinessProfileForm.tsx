'use client';

import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  markBusinessProfileCompleteAction,
  upsertBusinessProfileAction,
} from './actions';
import type {
  BusinessProfile,
  BusinessProfilePayload,
} from '@/lib/business-profile/api';
import {
  listRegions,
  listCommunesByRegion,
  type Region,
  type Commune,
} from '@/lib/territory/api';
import type { CommuneContext } from '@/lib/commune-context/api';
import { FieldShell } from '@/components/forms/FieldShell';
import { EmojiPopover } from '@/components/education/EmojiPopover';
import { HelpHint } from '@/components/education/HelpHint';

interface FieldHelp {
  term: string;
  description: string;
}

const FIELD_HELP: Record<string, FieldHelp> = {
  differentiators: {
    term: 'Diferenciadores',
    description:
      "Son las razones concretas por las que una clienta te elegiría a ti en lugar de otra peluquería. Mejor si son hechos verificables: evaluación previa con estilista titulada, colorimetría personalizada, productos sin amoníaco, etc. Evita palabras genéricas como 'calidad' o 'profesionalismo' sin ejemplo que las respalde.",
  },
};

const FIELD_HELP_SHORT: Record<string, string> = {
  differentiators:
    'Cosas concretas que te hacen distinta. La IA las usará para diferenciarte.',
  monthlyRevenueTarget:
    'Es solo una aspiración para tu negocio; no es la meta de una campaña individual.',
};

const FIELD_HELP_DESC_ID: Record<string, string> = {
  differentiators: 'bp-help-differentiators',
  monthlyRevenueTarget: 'bp-help-monthlyRevenueTarget',
};

interface Props {
  initialProfile: BusinessProfile | null;
  communeContext: CommuneContext | null;
}

type TagField =
  | 'brandVoiceKeywords'
  | 'wordsToAvoid'
  | 'preferredEmojiSemantics'
  | 'commonObjections'
  | 'qualifyingQuestions'
  | 'differentiators';

const TAG_FIELDS: TagField[] = [
  'brandVoiceKeywords',
  'wordsToAvoid',
  'preferredEmojiSemantics',
  'commonObjections',
  'qualifyingQuestions',
  'differentiators',
];

const TAG_LABELS: Record<TagField, string> = {
  brandVoiceKeywords: 'Cómo quieres que suene tu marca',
  wordsToAvoid: 'Palabras que la IA debe evitar en tus textos',
  preferredEmojiSemantics: 'Emblemas visuales que la IA usará en tus textos',
  commonObjections: 'Dudas o miedos frecuentes de tus clientas',
  qualifyingQuestions:
    'Preguntas que enviarás después del primer mensaje para confirmar que el contacto es real',
  differentiators: 'Razones por las que una clienta te elegiría sobre otra alternativa',
};

interface FormState {
  addressLine: string;
  neighborhood: string;
  regionCutCode: string;
  communeCutCode: string;
  phone: string;
  whatsappNumber: string;
  publicEmail: string;
  googleMapsUrl: string;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  preferredEmojiSemantics: string[];
  primaryCustomerProfile: string;
  commonObjections: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: string;
  monthlyAcquisitionGoal: string;
  monthlyRevenueTarget: string;
  costPerAcquisitionCap: string;
  tagline: string;
  differentiators: string[];
}

interface RequiredField {
  key:
    | 'addressLine'
    | 'neighborhood'
    | 'regionCutCode'
    | 'communeCutCode'
    | 'primaryCustomerProfile'
    | 'qualifyingQuestions'
    | 'brandVoiceKeywords';
  label: string;
  kind: 'text' | 'array';
}

const REQUIRED_FIELDS: RequiredField[] = [
  { key: 'addressLine', label: 'Dirección', kind: 'text' },
  { key: 'neighborhood', label: 'Barrio', kind: 'text' },
  { key: 'regionCutCode', label: 'Región', kind: 'text' },
  { key: 'communeCutCode', label: 'Comuna', kind: 'text' },
  { key: 'primaryCustomerProfile', label: 'Persona a la que quieres atraer', kind: 'text' },
  {
    key: 'qualifyingQuestions',
    label:
      'Preguntas que enviarás después del primer mensaje para confirmar que el contacto es real',
    kind: 'array',
  },
  { key: 'brandVoiceKeywords', label: 'Cómo quieres que suene tu marca', kind: 'array' },
];

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function formatClp(raw: string): string {
  if (raw.trim().length === 0) return '';
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return clpFormatter.format(num);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normalizeAccentInsensitive(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function countGraphemes(value: string): number {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
    let count = 0;
    for (const _ of segmenter.segment(value)) {
      count += 1;
    }
    return count;
  }
  return Array.from(value).length;
}

const EMOJI_CODE_POINT_REGEX = /[\p{Extended_Pictographic}]/u;

function isValidEmojiInput(value: string): boolean {
  if (!EMOJI_CODE_POINT_REGEX.test(value)) return false;
  const graphemes = countGraphemes(value);
  return graphemes >= 1 && graphemes <= 2;
}

function canAddToField(field: TagField, chipInput: string): boolean {
  const trimmed = chipInput.trim();
  if (trimmed.length === 0) return false;
  if (field === 'preferredEmojiSemantics') {
    return isValidEmojiInput(trimmed);
  }
  return true;
}

function resolveInitialRegionCut(profile: BusinessProfile | null, regions: Region[]): string {
  if (profile?.regionCutCode) return profile.regionCutCode;
  if (profile?.regionName) {
    const target = normalizeAccentInsensitive(profile.regionName);
    const match = regions.find((r) => normalizeAccentInsensitive(r.name) === target);
    if (match) return match.cutCode;
  }
  return '';
}

function resolveInitialCommuneCut(
  profile: BusinessProfile | null,
  communes: Commune[],
): string {
  if (profile?.communeCutCode) return profile.communeCutCode;
  if (profile?.communeName) {
    const target = normalizeAccentInsensitive(profile.communeName);
    const match = communes.find((c) => normalizeAccentInsensitive(c.name) === target);
    if (match) return match.cutCode;
  }
  return '';
}

function fromProfile(p: BusinessProfile | null, regions: Region[], communes: Commune[]): FormState {
  return {
    addressLine: p?.addressLine ?? '',
    neighborhood: p?.neighborhood ?? '',
    regionCutCode: resolveInitialRegionCut(p, regions),
    communeCutCode: resolveInitialCommuneCut(p, communes),
    phone: p?.phone ?? '',
    whatsappNumber: p?.whatsappNumber ?? '',
    publicEmail: p?.publicEmail ?? '',
    googleMapsUrl: p?.googleMapsUrl ?? '',
    brandVoiceKeywords: [...(p?.brandVoiceKeywords ?? [])],
    wordsToAvoid: [...(p?.wordsToAvoid ?? [])],
    preferredEmojiSemantics: [...(p?.preferredEmojiSemantics ?? [])],
    primaryCustomerProfile: p?.primaryCustomerProfile ?? '',
    commonObjections: [...(p?.commonObjections ?? [])],
    qualifyingQuestions: [...(p?.qualifyingQuestions ?? [])],
    weeklyServiceCapacity: p?.weeklyServiceCapacity !== null && p?.weeklyServiceCapacity !== undefined
      ? String(p.weeklyServiceCapacity)
      : '',
    monthlyAcquisitionGoal: p?.monthlyAcquisitionGoal !== null && p?.monthlyAcquisitionGoal !== undefined
      ? String(p.monthlyAcquisitionGoal)
      : '',
    monthlyRevenueTarget: p?.monthlyRevenueTarget ?? '',
    costPerAcquisitionCap: p?.costPerAcquisitionCap ?? '',
    tagline: p?.tagline ?? '',
    differentiators: [...(p?.differentiators ?? [])],
  };
}

function buildPayload(state: FormState): BusinessProfilePayload {
  const trimOrUndef = (v: string): string | undefined => {
    const t = normalizeText(v);
    return t.length > 0 ? t : undefined;
  };
  const numOrUndef = (v: string): number | undefined => {
    const t = v.trim();
    if (t.length === 0) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    addressLine: trimOrUndef(state.addressLine),
    neighborhood: trimOrUndef(state.neighborhood),
    regionCutCode: trimOrUndef(state.regionCutCode),
    communeCutCode: trimOrUndef(state.communeCutCode),
    phone: trimOrUndef(state.phone),
    whatsappNumber: trimOrUndef(state.whatsappNumber),
    publicEmail: trimOrUndef(state.publicEmail),
    googleMapsUrl: trimOrUndef(state.googleMapsUrl),
    brandVoiceKeywords: state.brandVoiceKeywords,
    wordsToAvoid: state.wordsToAvoid,
    preferredEmojiSemantics: state.preferredEmojiSemantics,
    primaryCustomerProfile: state.primaryCustomerProfile.trim(),
    commonObjections: state.commonObjections,
    qualifyingQuestions: state.qualifyingQuestions,
    weeklyServiceCapacity: numOrUndef(state.weeklyServiceCapacity),
    monthlyRevenueTarget: numOrUndef(state.monthlyRevenueTarget),
    costPerAcquisitionCap: numOrUndef(state.costPerAcquisitionCap),
    tagline: trimOrUndef(state.tagline),
    differentiators: state.differentiators,
  };
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.65rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#1f2933',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#52606d',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  flexWrap: 'wrap',
};

const helpShortStyle: React.CSSProperties = {
  color: '#52606d',
  fontSize: '0.8rem',
  lineHeight: 1.4,
};

const chipsHeaderLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  flexWrap: 'wrap',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#1f2933',
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e4e7eb',
  borderRadius: '12px',
  padding: '1rem',
  background: '#ffffff',
  display: 'grid',
  gap: '0.75rem',
};

export function BusinessProfileForm({ initialProfile, communeContext }: Props) {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [regionsLoaded, setRegionsLoaded] = useState(false);
  const [communesLoaded, setCommunesLoaded] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [chipInputs, setChipInputs] = useState<Record<TagField, string>>({
    brandVoiceKeywords: '',
    wordsToAvoid: '',
    preferredEmojiSemantics: '',
    commonObjections: '',
    qualifyingQuestions: '',
    differentiators: '',
  });
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const emojiPopoverAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastFetchedRegionRef = useRef<string | null>(null);

  // Carga el catálogo territorial (16 regiones) una sola vez.
  useEffect(() => {
    let cancelled = false;
    listRegions()
      .then((rows) => {
        if (!cancelled) {
          setRegions(rows);
          setRegionsLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga las comunas de la región seleccionada. Solo re-fetcheamos cuando la
  // región realmente cambia (no en cada actualización de estado del formulario),
  // y respetamos el seed inicial entregado por el server component.
  useEffect(() => {
    if (!state) return;
    const regionCutCode = state.regionCutCode;
    if (!regionCutCode) {
      if (lastFetchedRegionRef.current !== null) {
        setCommunes([]);
        lastFetchedRegionRef.current = null;
      }
      setCommunesLoaded(true);
      return;
    }
    if (lastFetchedRegionRef.current === regionCutCode) {
      setCommunesLoaded(true);
      return;
    }
    lastFetchedRegionRef.current = regionCutCode;
    let cancelled = false;
    setCommunesLoaded(false);
    listCommunesByRegion(regionCutCode)
      .then((res) => {
        if (!cancelled) {
          setCommunes(res.communes);
          setCommunesLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Inicializa el estado una vez que el catálogo de regiones está disponible
  // (necesitamos los nombres para reconciliar nombres huérfanos del backend).
  useEffect(() => {
    if (!regionsLoaded || state !== null) return;
    setState(fromProfile(initialProfile, regions, []));
  }, [regionsLoaded, initialProfile, regions, state]);

  // Reconcilia la comuna seleccionada si la región cambió: si la comuna
  // guardada no pertenece a la nueva región, intentamos matchear por nombre.
  useEffect(() => {
    if (!state || !communesLoaded) return;
    if (!state.communeCutCode) return;
    const match = communes.find((c) => c.cutCode === state.communeCutCode);
    if (match) return;
    if (!initialProfile?.communeName) return;
    const target = normalizeAccentInsensitive(initialProfile.communeName);
    const byName = communes.find((c) => normalizeAccentInsensitive(c.name) === target);
    if (byName) {
      setState((s) => (s ? { ...s, communeCutCode: byName.cutCode } : s));
    } else {
      setState((s) => (s ? { ...s, communeCutCode: '' } : s));
    }
  }, [communesLoaded, communes, state, initialProfile?.communeName]);

  const completeness = useMemo(() => {
    if (!state) return { completed: 0, total: REQUIRED_FIELDS.length, missing: [] as string[] };
    const missing: string[] = [];
    let completed = 0;
    for (const { key, kind, label } of REQUIRED_FIELDS) {
      const value = state[key];
      let ok = false;
      if (kind === 'text') {
        ok = typeof value === 'string' && value.trim().length > 0;
      } else {
        ok = Array.isArray(value) && value.filter((v) => v.trim().length > 0).length > 0;
      }
      if (ok) completed += 1;
      else missing.push(label);
    }
    return { completed, total: REQUIRED_FIELDS.length, missing };
  }, [state]);

  const setTextField =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      const value = e.target.value;
      setState((s) => (s ? { ...s, [key]: value } : s));
    };

  const setMoneyField =
    (key: 'monthlyRevenueTarget' | 'costPerAcquisitionCap') =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const raw = e.target.value.replace(/[^\d]/g, '');
      setState((s) => (s ? { ...s, [key]: raw } : s));
    };

  const addTag = (field: TagField) => {
    const value = chipInputs[field].trim();
    if (value.length === 0 || !state) return;
    if (field === 'preferredEmojiSemantics' && !isValidEmojiInput(value)) return;
    setState({ ...state, [field]: [...state[field], value] });
    setChipInputs((c) => ({ ...c, [field]: '' }));
  };

  const addEmoji = (emoji: string) => {
    setState((s) =>
      s
        ? { ...s, preferredEmojiSemantics: [...s.preferredEmojiSemantics, emoji] }
        : s,
    );
  };

  const closeEmojiPopover = useCallback(() => {
    setEmojiPopoverOpen(false);
  }, []);

  const removeTag = (field: TagField, tag: string) => {
    setState((s) => (s ? { ...s, [field]: s[field].filter((t) => t !== tag) } : s));
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state) return;
    if (state.primaryCustomerProfile.trim().length === 0) {
      setError('El perfil del cliente ideal es obligatorio para guardar.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await upsertBusinessProfileAction(buildPayload(state));
      if (result.profile) {
        setState(fromProfile(result.profile, regions, communes));
      }
      setToast('Perfil actualizado');
      router.replace('/business-profile?status=saved');
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onComplete = async () => {
    setError(null);
    setCompleting(true);
    try {
      const result = await markBusinessProfileCompleteAction();
      if (result.profile && state) {
        setState(fromProfile(result.profile, regions, communes));
      }
      setToast('Perfil marcado como completo');
      router.replace('/business-profile?status=completed');
      router.refresh();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  if (!state) {
    return (
      <p role="status" style={{ color: '#52606d' }}>
        Cargando catálogo territorial…
      </p>
    );
  }

  const profileIncomplete = initialProfile?.profileCompletedAt == null;

  return (
    <form onSubmit={onSave} style={{ display: 'grid', gap: '1rem' }}>
      <StatusIndicator completeness={completeness} />

      {toast && (
        <p
          role="status"
          style={{
            background: '#dcfce7',
            color: '#166534',
            padding: '0.75rem',
            borderRadius: '8px',
            margin: 0,
          }}
        >
          {toast}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: '8px',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <LocationSection
        state={state}
        regions={regions}
        communes={communes}
        communesLoaded={communesLoaded}
        setState={setState}
        setTextField={setTextField}
      />

      <CommuneContextBlock
        regionName={initialProfile?.regionName ?? null}
        communeName={initialProfile?.communeName ?? null}
        context={communeContext}
      />

      <ContactSection state={state} setTextField={setTextField} />

      <VoiceSection state={state} setTextField={setTextField} />

      {TAG_FIELDS.map((field) => (
        <ChipsSection
          key={field}
          field={field}
          label={TAG_LABELS[field]}
          state={state}
          chipInput={chipInputs[field]}
          canAdd={canAddToField(field, chipInputs[field])}
          emojiValidationActive={field === 'preferredEmojiSemantics'}
          emojiPopoverOpen={field === 'preferredEmojiSemantics' && emojiPopoverOpen}
          emojiPopoverAnchorRef={
            field === 'preferredEmojiSemantics' ? emojiPopoverAnchorRef : null
          }
          help={field === 'differentiators' ? FIELD_HELP.differentiators : undefined}
          helpKey={field === 'differentiators' ? 'differentiators' : undefined}
          onToggleEmojiPopover={() => setEmojiPopoverOpen((v) => !v)}
          onInputChange={(v) => setChipInputs((c) => ({ ...c, [field]: v }))}
          onAdd={() => addTag(field)}
          onRemove={(tag) => removeTag(field, tag)}
        />
      ))}

      {emojiPopoverOpen && (
        <EmojiPopover
          onSelect={addEmoji}
          onClose={closeEmojiPopover}
          anchorRef={emojiPopoverAnchorRef}
        />
      )}

      <CapacitySection
        state={state}
        setTextField={setTextField}
        setMoneyField={setMoneyField}
        formatClp={formatClp}
      />

      <ActionsBar saving={saving} completing={completing} onComplete={onComplete} />
    </form>
  );
}

function StatusIndicator({
  completeness,
}: {
  completeness: { completed: number; total: number; missing: string[] };
}) {
  const ready = completeness.missing.length === 0;
  const containerStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '1px solid #e4e7eb',
    background: ready ? '#dcfce7' : '#fff7ed',
    color: ready ? '#166534' : '#9a3412',
    margin: 0,
    display: 'grid',
    gap: '0.25rem',
  };
  return (
    <div role="status" style={containerStyle}>
      {ready ? (
        <strong style={{ margin: 0 }}>Perfil listo ({completeness.total} campos completos)</strong>
      ) : (
        <strong style={{ margin: 0 }}>
          Perfil incompleto: faltan {completeness.missing.length} campos (
          {completeness.completed} de {completeness.total} completos)
        </strong>
      )}
      {!ready && (
        <span style={{ fontSize: '0.85rem' }}>{completeness.missing.join(', ')}</span>
      )}
    </div>
  );
}

function LocationSection({
  state,
  regions,
  communes,
  communesLoaded,
  setState,
  setTextField,
}: {
  state: FormState;
  regions: Region[];
  communes: Commune[];
  communesLoaded: boolean;
  setState: React.Dispatch<React.SetStateAction<FormState | null>>;
  setTextField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Ubicación</h3>
      <Field label="Dirección" htmlFor="bp-addressLine">
        <input
          id="bp-addressLine"
          type="text"
          value={state.addressLine}
          onChange={setTextField('addressLine')}
          style={inputStyle}
          maxLength={200}
        />
      </Field>
      <Field label="Barrio" htmlFor="bp-neighborhood">
        <input
          id="bp-neighborhood"
          type="text"
          value={state.neighborhood}
          onChange={setTextField('neighborhood')}
          style={inputStyle}
          maxLength={120}
        />
      </Field>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Field label="Región" htmlFor="bp-regionCutCode">
          <select
            id="bp-regionCutCode"
            value={state.regionCutCode}
            onChange={(e) => {
              const cut = e.target.value;
              setState((s) =>
                s ? { ...s, regionCutCode: cut, communeCutCode: '' } : s,
              );
            }}
            style={inputStyle}
          >
            <option value="">Selecciona una región</option>
            {regions.map((region) => (
              <option key={region.cutCode} value={region.cutCode}>
                {region.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comuna" htmlFor="bp-communeCutCode">
          <select
            id="bp-communeCutCode"
            value={state.communeCutCode}
            onChange={setTextField('communeCutCode')}
            style={inputStyle}
            disabled={!state.regionCutCode || !communesLoaded}
          >
            <option value="">
              {!state.regionCutCode
                ? 'Selecciona primero una región'
                : !communesLoaded
                  ? 'Cargando comunas…'
                  : 'Selecciona una comuna'}
            </option>
            {communes.map((commune) => (
              <option key={commune.cutCode} value={commune.cutCode}>
                {commune.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Google Maps URL" htmlFor="bp-googleMapsUrl">
        <input
          id="bp-googleMapsUrl"
          type="url"
          value={state.googleMapsUrl}
          onChange={setTextField('googleMapsUrl')}
          style={inputStyle}
          maxLength={500}
          placeholder="https://maps.google.com/..."
        />
      </Field>
    </section>
  );
}

function ContactSection({
  state,
  setTextField,
}: {
  state: FormState;
  setTextField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Contacto</h3>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Field label="Teléfono" htmlFor="bp-phone">
          <input
            id="bp-phone"
            type="tel"
            value={state.phone}
            onChange={setTextField('phone')}
            style={inputStyle}
            maxLength={40}
          />
        </Field>
        <Field label="WhatsApp" htmlFor="bp-whatsappNumber">
          <input
            id="bp-whatsappNumber"
            type="tel"
            value={state.whatsappNumber}
            onChange={setTextField('whatsappNumber')}
            style={inputStyle}
            maxLength={40}
          />
        </Field>
        <Field label="Email público" htmlFor="bp-publicEmail">
          <input
            id="bp-publicEmail"
            type="email"
            value={state.publicEmail}
            onChange={setTextField('publicEmail')}
            style={inputStyle}
            maxLength={180}
          />
        </Field>
      </div>
    </section>
  );
}

function VoiceSection({
  state,
  setTextField,
}: {
  state: FormState;
  setTextField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
}) {
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Cómo habla tu marca</h3>
      <FieldShell id="bp-tagline" label="Frase corta que identifica tu negocio">
        <input
          id="bp-tagline"
          type="text"
          value={state.tagline}
          onChange={setTextField('tagline')}
          style={inputStyle}
          maxLength={200}
        />
      </FieldShell>
      <Field
        label="Persona a la que quieres atraer"
        htmlFor="bp-primaryCustomerProfile"
        error={
          state.primaryCustomerProfile.trim().length === 0
            ? 'La descripción de tu clienta ideal es obligatoria.'
            : undefined
        }
      >
        <textarea
          id="bp-primaryCustomerProfile"
          value={state.primaryCustomerProfile}
          onChange={setTextField('primaryCustomerProfile')}
          style={{ ...inputStyle, minHeight: '4.5rem', fontFamily: 'inherit' }}
          maxLength={2000}
        />
      </Field>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  help,
  helpKey,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  help?: FieldHelp;
  helpKey?: keyof typeof FIELD_HELP_SHORT;
  children: ReactElement;
}) {
  const shortText = helpKey ? FIELD_HELP_SHORT[helpKey] : undefined;
  const descriptionId = helpKey ? FIELD_HELP_DESC_ID[helpKey] : undefined;
  const mergedDescribedBy = (() => {
    if (!descriptionId) return undefined;
    const childProps = (children as ReactElement<{ 'aria-describedby'?: string }>).props;
    const prev = childProps['aria-describedby'];
    return prev ? `${prev} ${descriptionId}` : descriptionId;
  })();
  const childWithAria = mergedDescribedBy
    ? cloneElement(children, { 'aria-describedby': mergedDescribedBy })
    : children;
  return (
    <label htmlFor={htmlFor} style={{ display: 'grid', gap: '0.25rem' }}>
      <span style={labelTextStyle}>
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
        {help ? <HelpHint term={help.term} description={help.description} /> : null}
      </span>
      {shortText ? (
        <span id={descriptionId} style={helpShortStyle}>
          {shortText}
        </span>
      ) : null}
      {childWithAria}
      {error ? (
        <span role="alert" style={{ color: '#991b1b', fontSize: '0.85rem' }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Chip({
  field,
  label,
  tag,
  onRemove,
}: {
  field: TagField;
  label: string;
  tag: string;
  onRemove: (tag: string) => void;
}) {
  return (
    <span
      data-testid={`bp-chip-${field}-${tag}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.5rem 0.25rem 0.65rem',
        borderRadius: '999px',
        background: '#e0e7ff',
        color: '#3730a3',
        fontSize: '0.85rem',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.75rem', color: '#3730a3' }}>?</span>
      <span>{tag}</span>
      <button
        type="button"
        aria-label={`Quitar ${tag} de ${label}`}
        onClick={() => onRemove(tag)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#3730a3',
          padding: 0,
          fontSize: '0.95rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

function ChipsSection({
  field,
  label,
  state,
  chipInput,
  canAdd,
  emojiValidationActive = false,
  emojiPopoverOpen = false,
  emojiPopoverAnchorRef = null,
  help,
  helpKey,
  onToggleEmojiPopover,
  onInputChange,
  onAdd,
  onRemove,
}: {
  field: TagField;
  label: string;
  state: FormState;
  chipInput: string;
  canAdd: boolean;
  emojiValidationActive?: boolean;
  emojiPopoverOpen?: boolean;
  emojiPopoverAnchorRef?: React.RefObject<HTMLButtonElement> | null;
  help?: FieldHelp;
  helpKey?: keyof typeof FIELD_HELP_SHORT;
  onToggleEmojiPopover?: () => void;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (tag: string) => void;
}) {
  const tags = state[field];
  const placeholder = field === 'brandVoiceKeywords' ? 'cercana, profesional…' : undefined;
  const placeholderForEmoji = emojiValidationActive ? '✨' : undefined;
  const showEmojiError =
    emojiValidationActive && chipInput.trim().length > 0 && !canAdd;
  const shortText = helpKey ? FIELD_HELP_SHORT[helpKey] : undefined;
  const descriptionId = helpKey ? FIELD_HELP_DESC_ID[helpKey] : undefined;
  return (
    <section style={sectionStyle}>
      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={chipsHeaderLabelStyle}>
          <span>{label}</span>
          {help ? <HelpHint term={help.term} description={help.description} /> : null}
        </span>
        {shortText ? (
          <span id={descriptionId} style={helpShortStyle}>
            {shortText}
          </span>
        ) : null}
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {tags.length === 0 && (
          <span style={{ color: '#9aa5b1', fontSize: '0.85rem' }}>(sin elementos)</span>
        )}
        {tags.map((tag) => (
          <Chip key={tag} field={field} label={label} tag={tag} onRemove={onRemove} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <input
          type="text"
          aria-label={`Agregar ${label}`}
          aria-describedby={descriptionId}
          aria-invalid={showEmojiError || undefined}
          value={chipInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canAdd) onAdd();
            }
          }}
          placeholder={placeholder ?? placeholderForEmoji}
          style={{ ...inputStyle, flex: 1, minWidth: '180px' }}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          aria-disabled={!canAdd}
          style={{
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #1f2933',
            background: '#ffffff',
            color: '#1f2933',
            cursor: canAdd ? 'pointer' : 'not-allowed',
            opacity: canAdd ? 1 : 0.55,
            fontSize: '0.85rem',
          }}
        >
          Agregar
        </button>
        {emojiValidationActive && onToggleEmojiPopover ? (
          <button
            ref={emojiPopoverAnchorRef ?? undefined}
            type="button"
            onClick={onToggleEmojiPopover}
            aria-haspopup="dialog"
            aria-expanded={emojiPopoverOpen}
            aria-label="Emojis comunes"
            data-testid="bp-emoji-popover-trigger"
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd2d9',
              background: emojiPopoverOpen ? '#e0e7ff' : '#ffffff',
              color: '#1f2933',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Emojis comunes
          </button>
        ) : null}
      </div>
      {showEmojiError ? (
        <span role="alert" style={{ color: '#991b1b', fontSize: '0.85rem' }}>
          Ingresa un emoji (máximo 2 elementos) para poder agregarlo.
        </span>
      ) : null}
    </section>
  );
}

function CapacitySection({
  state,
  setTextField,
  setMoneyField,
  formatClp,
}: {
  state: FormState;
  setTextField: (
    key: keyof FormState,
  ) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  setMoneyField: (
    key: 'monthlyRevenueTarget' | 'costPerAcquisitionCap',
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  formatClp: (raw: string) => string;
}) {
  const explainerStyle: React.CSSProperties = {
    margin: 0,
    color: '#52606d',
    fontSize: '0.85rem',
    lineHeight: 1.45,
  };
  return (
    <section style={sectionStyle}>
      <h3 style={{ margin: 0, fontSize: '1rem' }}>Capacidad y aspiración</h3>
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Field
          label="Servicios que puedes atender por semana sin afectar la calidad"
          htmlFor="bp-weeklyServiceCapacity"
        >
          <input
            id="bp-weeklyServiceCapacity"
            type="number"
            min={0}
            value={state.weeklyServiceCapacity}
            onChange={setTextField('weeklyServiceCapacity')}
            style={inputStyle}
          />
        </Field>
        <Field
          label="Cuánto te gustaría facturar al mes (aspiración)"
          htmlFor="bp-monthlyRevenueTarget"
          helpKey="monthlyRevenueTarget"
        >
          <input
            id="bp-monthlyRevenueTarget"
            type="text"
            inputMode="numeric"
            value={formatClp(state.monthlyRevenueTarget)}
            onChange={setMoneyField('monthlyRevenueTarget')}
            style={inputStyle}
            placeholder="$ 0"
          />
        </Field>
        <FieldShell
          id="bp-cpaCap"
          label="Máximo aceptable por adquisición (tope de CPA)"
          hint="Monto tope que estás dispuesto a invertir por cada reserva o venta antes de detener o revisar la campaña. Sin historial, se usará como tope máximo, no como CPA esperado."
        >
          <input
            id="bp-cpaCap"
            type="text"
            inputMode="numeric"
            value={formatClp(state.costPerAcquisitionCap)}
            onChange={setMoneyField('costPerAcquisitionCap')}
            style={inputStyle}
            placeholder="$ 0"
          />
        </FieldShell>
      </div>
      <p style={explainerStyle}>
        Define un tope máximo de inversión por cada reserva o venta efectiva.
        Si no lo defines y aún no tienes historial, la IA propondrá un
        Costo por adquisición (CPA) objetivo basado en tu servicio, precio y
        meta.
      </p>
    </section>
  );
}

function ActionsBar({
  saving,
  completing,
  onComplete,
}: {
  saving: boolean;
  completing: boolean;
  onComplete: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
      <button
        type="button"
        onClick={onComplete}
        disabled={completing || saving}
        style={{
          padding: '0.55rem 1rem',
          borderRadius: '8px',
          border: '1px solid #1f2933',
          background: '#ffffff',
          color: '#1f2933',
          cursor: completing || saving ? 'not-allowed' : 'pointer',
          opacity: completing || saving ? 0.6 : 1,
        }}
      >
        {completing ? 'Marcando...' : 'Marcar como completo'}
      </button>
      <button
        type="submit"
        disabled={saving || completing}
        style={{
          padding: '0.55rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid #1f2933',
          background: '#1f2933',
          color: '#ffffff',
          cursor: saving || completing ? 'not-allowed' : 'pointer',
          opacity: saving || completing ? 0.6 : 1,
        }}
      >
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}

function CommuneContextBlock({
  regionName,
  communeName,
  context,
}: {
  regionName: string | null;
  communeName: string | null;
  context: CommuneContext | null;
}) {
  if (!regionName && !communeName && !context) {
    return null;
  }
  const hasContext = context !== null;
  const containerStyle: React.CSSProperties = {
    border: '1px solid #e4e7eb',
    borderRadius: '12px',
    padding: '1rem',
    background: '#f8fafc',
    display: 'grid',
    gap: '0.5rem',
    margin: 0,
  };
  return (
    <aside
      data-testid="bp-commune-context-block"
      style={containerStyle}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong style={{ margin: 0, fontSize: '0.95rem' }}>
          Contexto territorial orientativo
        </strong>
        <span
          style={{
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          {hasContext ? `${context!.source} · ${context!.year}` : 'Sin datos para esta comuna'}
        </span>
      </header>
      <p
        style={{
          margin: 0,
          color: '#1f2933',
          fontSize: '0.9rem',
        }}
      >
        <strong>Región:</strong> {regionName ?? '—'}
        {' · '}
        <strong>Comuna:</strong> {communeName ?? '—'}
      </p>
      {hasContext ? (
        <>
          <p
            style={{
              margin: 0,
              color: '#52606d',
              fontSize: '0.85rem',
            }}
          >
            <strong>Población estimada (aproximado):</strong>{' '}
            {context!.population.toLocaleString('es-CL')} hab.
            {' · '}
            <strong>Ingreso medio por hogar:</strong>{' '}
            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
              context!.avgHouseholdIncomeCLP,
            )}
          </p>
          <p
            style={{
              margin: 0,
              color: '#1f2933',
              fontSize: '0.9rem',
            }}
          >
            <strong>Perfil general:</strong> {context!.profileDescription}
          </p>
        </>
      ) : (
        <p
          style={{
            margin: 0,
            color: '#9a3412',
            fontSize: '0.85rem',
          }}
        >
          Esta comuna aún no tiene una estimación de contexto cargada. La IA seguirá
          funcionando, pero我们会 mostrar menos información cualitativa en los prompts.
        </p>
      )}
    </aside>
  );
}
