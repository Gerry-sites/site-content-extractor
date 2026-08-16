export function normalizeUrl(input: string, base?: string): string {
  const url = new URL(input, base);
  url.hash = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  // Drop common tracking params
  const drop = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
  ];
  for (const key of drop) {
    url.searchParams.delete(key);
  }
  // Sort remaining params for determinism
  const entries = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [k, v] of entries) {
    url.searchParams.append(k, v);
  }
  return url.toString();
}

export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function isInternalLink(href: string, seedUrl: string): boolean {
  try {
    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      href.startsWith("data:")
    ) {
      return false;
    }
    const resolved = new URL(href, seedUrl);
    const seed = new URL(seedUrl);
    return resolved.origin === seed.origin;
  } catch {
    return false;
  }
}

export function toAbsoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function pathFromUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname;
  if (!path || path === "/") return "home";
  return path.replace(/^\/+|\/+$/g, "");
}

export function isAssetUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt|mp3|mp4|webm|mov|avi|css|js|map|woff2?|ttf|eot)$/i.test(
      pathname,
    );
  } catch {
    return false;
  }
}

export function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url, "https://example.com").pathname.toLowerCase();
    return /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i.test(pathname);
  } catch {
    return false;
  }
}
