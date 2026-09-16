export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  next?: { cache?: 'no-store' | 'force-cache' | RequestCache; revalidate?: number },
): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: next?.cache,
    next: next?.revalidate ? { revalidate: next.revalidate } : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}
