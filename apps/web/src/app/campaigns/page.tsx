import { permanentRedirect } from 'next/navigation';

/**
 * `/campaigns` ya no es la ruta principal de campañas: la nueva pestaña
 * "Planes comerciales" vive en `/campaign-brief`. Esta página existe
 * únicamente para redirigir permanentemente a esa URL.
 */
export default function CampaignsRedirectPage(): never {
  permanentRedirect('/campaign-brief');
}
