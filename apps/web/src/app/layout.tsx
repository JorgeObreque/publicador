import Link from 'next/link';
import { apiBaseUrl, apiFetch } from '@/lib/api';

interface HealthResponse {
  status: string;
  uptime?: number;
}

interface NavLink {
  href: string;
  label: string;
}

const NAV: NavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/campaigns', label: 'Campañas' },
  { href: '/appointments', label: 'Citas' },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let health: HealthResponse | null = null;
  let healthError: string | null = null;
  try {
    health = await apiFetch<HealthResponse>('/health/live', undefined, { cache: 'no-store' });
  } catch (err) {
    healthError = (err as Error).message;
  }

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0, background: '#f7f8fa', color: '#1f2933' }}>
        <header
          style={{
            background: '#1f2933',
            color: '#ffffff',
            padding: '1rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <strong style={{ fontSize: '1.1rem' }}>Publicador</strong>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{ color: '#ffffff', textDecoration: 'none', fontSize: '0.95rem' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span style={{ fontSize: '0.85rem', color: '#cbd2d9' }}>
            API: {health ? `OK (${health.status})` : `error${healthError ? `: ${healthError}` : ''}`}
          </span>
          <span style={{ display: 'none' }}>{apiBaseUrl}</span>
        </header>
        <main style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
