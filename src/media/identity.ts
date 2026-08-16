import { wixMediaId } from "./urls.js";

/**
 * Stable platform id for a remote image when the CMS encodes one in the URL.
 * SHA-256 of the downloaded bytes is the identity that every site has.
 */
export function platformMediaId(urlOrId: string): string | undefined {
  const wix = wixMediaId(urlOrId);
  if (wix) return wix;
  return wordpressMediaId(urlOrId);
}

function wordpressMediaId(url: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split("?")[0] ?? url;
  }
  const match = pathname.match(/wp-content\/uploads\/(.+)$/i);
  if (!match?.[1]) return undefined;
  let rest = match[1];
  try {
    rest = decodeURIComponent(rest);
  } catch {
    /* keep the raw path */
  }
  return rest.replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, "").toLowerCase();
}

export function galleryIdentityKey(item: { mediaId?: string; hash?: string }): string | undefined {
  if (item.mediaId) return `id:${item.mediaId.toLowerCase()}`;
  if (item.hash) return `hash:${item.hash.toLowerCase()}`;
  return undefined;
}
