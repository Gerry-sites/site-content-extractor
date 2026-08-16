import { XMLParser } from "./xml.js";

export async function fetchSitemapUrls(
  sitemapUrl: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
  depth = 0,
): Promise<string[]> {
  if (depth > 3) return [];

  try {
    const res = await fetchImpl(sitemapUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser();
    const doc = parser.parse(xml) as {
      urlset?: { url?: LocEntry | LocEntry[] };
      sitemapindex?: { sitemap?: LocEntry | LocEntry[] };
    };

    const urls: string[] = [];

    // urlset
    const urlEntries = asArray(doc.urlset?.url);
    for (const entry of urlEntries) {
      const loc = entry?.loc;
      if (typeof loc === "string" && loc.trim()) urls.push(loc.trim());
    }

    // sitemap index
    const nested = asArray(doc.sitemapindex?.sitemap);
    for (const entry of nested) {
      const loc = entry?.loc;
      if (typeof loc === "string" && loc.trim()) {
        const child = await fetchSitemapUrls(loc.trim(), userAgent, fetchImpl, depth + 1);
        urls.push(...child);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

type LocEntry = { loc?: string };

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
