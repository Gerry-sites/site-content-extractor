import { normalizeUrl, toAbsoluteUrl, isInternalLink, isAssetUrl } from "../utils/url.js";

export const DEFAULT_CONTENT_PATHS = ["/about", "/contact"];

export function extraSeedUrls(seedUrl: string, paths: string[] = DEFAULT_CONTENT_PATHS): string[] {
  const origin = new URL(seedUrl).origin;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    const absolute = `${origin}${path}`;
    const normalized = normalizeUrl(absolute, seedUrl);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function discoveryFeedUrls(seedUrl: string): string[] {
  const origin = new URL(seedUrl).origin;
  return [`${origin}/feed`, `${origin}/feed/atom`, `${origin}/rss.xml`];
}

/**
 * Archives, feeds, and comment permalinks are not content pages.
 * Crawling them explodes a WordPress site into hundreds of tag/category URLs.
 */
export function isLowValueCrawlUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    if (/^\/(tag|category|author|comments)(\/|$)/.test(path)) return true;
    if (/\/feed$/.test(path) || path.endsWith("/feed/atom")) return true;
    if (/^\/wp-(admin|login|json)/.test(path)) return true;
    const parts = path.split("/").filter(Boolean);
    if (
      /^\d{4}$/.test(parts[0] ?? "") &&
      parts.length <= 2 &&
      (!parts[1] || /^\d{2}$/.test(parts[1]))
    ) {
      return true;
    }
    if (
      parts.length >= 5 &&
      /^\d{4}$/.test(parts[0] ?? "") &&
      /^\d{2}$/.test(parts[1] ?? "") &&
      /^\d{2}$/.test(parts[2] ?? "")
    ) {
      return true;
    }
    if (
      parsed.searchParams.has("share") ||
      parsed.searchParams.has("replytocom") ||
      parsed.searchParams.has("attachment_id")
    ) {
      return true;
    }
    if (parts.includes("attachment") || /\/attachment(\/|$)/.test(path)) return true;
    if (/\/wp-content\/uploads\//i.test(path)) return true;
    if (/\.(xml|xsl|json|ico)$/i.test(path) || path.endsWith("/osd.xml")) return true;
    if (path === "/" && parsed.search.length > 1 && !parsed.searchParams.has("p")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function collectInternalUrls(hrefs: string[], seedUrl: string): string[] {
  const results = new Set<string>();
  for (const href of hrefs) {
    const absolute = toAbsoluteUrl(href, seedUrl);
    if (!absolute) continue;
    if (!isInternalLink(absolute, seedUrl)) continue;
    if (isAssetUrl(absolute)) continue;
    results.add(normalizeUrl(absolute, seedUrl));
  }
  return [...results];
}
