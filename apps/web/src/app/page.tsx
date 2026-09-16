import { apiFetch, apiBaseUrl } from '@/lib/api';

interface HealthResponse {
  status: string;
  uptime?: number;
}

export const dynamic = 'force-dynamic';

export default async function Home() {
  let health: HealthResponse | null = null;
  let error: string | null = null;
  try {
    health = await apiFetch<HealthResponse>('/health/live', undefined, { cache: 'no-store' });
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <main>
      <h1>Publicador</h1>
      <p>Plataforma de campañas Meta con aprendizaje iterativo.</p>
      <p>
        API base: <code>{apiBaseUrl}</code>
      </p>
      {health && (
        <p>
          Estado: <strong>{health.status}</strong>
        </p>
      )}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
    </main>
  );
}
