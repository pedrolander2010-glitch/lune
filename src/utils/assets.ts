/**
 * Asset URL helper to resolve public assets correctly with Vite base path (e.g. /lune/ on GitHub Pages)
 */
export function getAssetUrl(path: string): string {
  if (!path) return '';
  // Don't modify already absolute URLs, data URIs, or blob URIs
  if (/^(?:https?:|\/\/|data:|blob:)/.test(path)) {
    return path;
  }

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${cleanBase}${cleanPath}`;
}

export const LUNE_LOGO_URL = getAssetUrl('logo.svg');
export const LUNE_ICON_URL = getAssetUrl('icon.svg');
export const LUNE_ICON_192_URL = getAssetUrl('icon-192.png');
export const LUNE_ICON_512_URL = getAssetUrl('icon-512.png');
