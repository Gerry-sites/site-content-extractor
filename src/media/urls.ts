/**
 * Platform-agnostic media URL upgrades.
 * Wix chrome hashes are product icons (Facebook/Instagram 18px), not a client site.
 */

const WIX_CHROME_IDS = new Set([
  "ce6ec7c11b174c0581e20f42bb865ce3.png",
  "fdcfaba150fc427da298a00cb09d91c1.png",
]);

const WIX_MEDIA_ID = /([a-z0-9]+_[a-z0-9]+~mv2(?:_d_\d+_\d+_s_[\d_]+)?\.(?:jpg|jpeg|png|webp))/i;

const SIZE_QUERY_KEYS = ["w", "h", "crop", "resize", "fit", "quality", "q", "ssl", "strip"];

export function wixMediaId(urlOrId: string): string | undefined {
  let value = String(urlOrId);
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep the raw value when it is not URI-encoded */
  }
  const match = value.match(WIX_MEDIA_ID);
  return match ? match[1]!.toLowerCase() : undefined;
}

export function looksLikeImageUrl(url: string): boolean {
  if (!url || url.startsWith("data:")) return false;
  if (/\.(mp4|webm|mov|m4v|m3u8)(?:$|\?)/i.test(url) || /video\.wixstatic/i.test(url)) {
    return false;
  }
  if (
    /static\.wixstatic\.com\/media|filesusr\.com|squarespace\.com|sqspcdn\.com|wp-content\/uploads|\.wp\.com\//.test(
      url,
    )
  ) {
    return true;
  }
  return /\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(url);
}

export function isSkippableAsset(url: string): boolean {
  if (!url || url.startsWith("data:")) return true;
  if (/\.(svg)(?:$|\?)/i.test(url) && /wixstatic|parastorage/.test(url)) {
    return true;
  }
  for (const id of WIX_CHROME_IDS) {
    if (url.includes(id)) return true;
  }
  if (/\/v1\/fill\/w_1[0-9],h_1[0-9]/.test(url)) return true;
  if (/favicon|pfavico/i.test(url)) return true;
  if (/static\.wixstatic\.com/i.test(url) && /[?&]token=/.test(url)) return true;
  return false;
}

/** Remove Wix chrome / data-URI imgs so they never land in Markdown. */
export function stripSkippableImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src && isSkippableAsset(src)) return "";
    return tag;
  });
}

/**
 * Prefer a large JPEG instead of Wix cropped gallery thumbs (`/v1/fill/w_290,...`).
 */
export function upgradeWixUrl(url: string): string {
  const id = wixMediaId(url);
  if (id) {
    const name = id.replace(/[^\w.~-]+/g, "-");
    return `https://static.wixstatic.com/media/${id}/v1/fit/w_1800,h_1800,al_c,q_85,enc_jpg/${name}`;
  }
  if (/\/v1\/fill\//.test(url) && /wixstatic|filesusr\.com/i.test(url)) {
    return url.replace(/\/v1\/fill\/[^/]+\//, "/v1/fit/w_1800,h_1800,al_c,q_85,enc_jpg/");
  }
  return url;
}

/**
 * Drop WordPress.com / Photon size query strings so originals download.
 */
export function wordpressOriginalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let changed = false;
    for (const key of SIZE_QUERY_KEYS) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

/** Upgrade a remote media URL for download. Non-matching URLs are unchanged. */
export function upgradeMediaUrl(url: string): string {
  if (!url) return url;
  const wix = upgradeWixUrl(url);
  if (wix !== url) return wix;
  return wordpressOriginalUrl(url);
}

export function isPlatformCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "static.wixstatic.com" ||
    host.endsWith(".wixstatic.com") ||
    host.endsWith(".wp.com") ||
    host.endsWith(".wordpress.com") ||
    host.endsWith(".filesusr.com") ||
    host.endsWith(".sqspcdn.com") ||
    host.endsWith(".squarespace.com")
  );
}

export function isOtherHost(imageUrl: string, seedUrl: string): boolean {
  try {
    const imageHost = new URL(imageUrl).hostname;
    const seedHost = new URL(seedUrl).hostname;
    if (
      imageHost === seedHost ||
      imageHost === `www.${seedHost}` ||
      seedHost === `www.${imageHost}`
    ) {
      return false;
    }
    if (isPlatformCdnHost(imageHost)) return false;
    return true;
  } catch {
    return false;
  }
}
