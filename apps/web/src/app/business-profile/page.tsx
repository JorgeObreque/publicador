import { BusinessProfileForm } from './BusinessProfileForm';
import {
  getBusinessProfileAction,
  getBusinessContextAction,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function BusinessProfilePage() {
  let profile = null;
  let context = null;
  let error: string | null = null;
  try {
    const response = await getBusinessProfileAction();
    profile = response.profile;
    const ctx = await getBusinessContextAction();
    context = ctx.context;
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Contexto del negocio</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Define la realidad de tu negocio para que la IA genere propuestas con fundamento.
        </p>
      </header>
      {error && (
        <p
          style={{
            color: '#991b1b',
            background: '#fee2e2',
            padding: '0.75rem',
            borderRadius: '8px',
          }}
        >
          No pudimos cargar el perfil: {error}
        </p>
      )}
      {profile && (
        <BusinessProfileForm
          initialProfile={profile}
          communeContext={context}
        />
      )}
    </section>
  );
}