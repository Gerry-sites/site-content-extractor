import { collectInternalUrls } from "./seeds.js";

type FeedFetch = typeof fetch;

/**
 * Pull <link> / <guid> URLs out of RSS/Atom XML. Not stored as a page.
 */
export function extractUrlsFromFeedXml(xml: string, seedUrl: string): string[] {
  const hrefs: string[] = [];
  for (const match of xml.matchAll(/<(?:link|guid|id)[^>]*>([^<]+)<\//gi)) {
    hrefs.push(match[1]!.trim());
  }
  for (const match of xml.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)) {
    hrefs.push(match[1]!.trim());
  }
  return collectInternalUrls(hrefs, seedUrl);
}

export async function discoverFeedUrls(
  seedUrl: string,
  feedUrls: string[],
  userAgent: string,
  fetchImpl: FeedFetch = fetch,
): Promise<string[]> {
  const found = new Set<string>();
  for (const feedUrl of feedUrls) {
    try {
      const res = await fetchImpl(feedUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) continue;
      const xml = await res.text();
      for (const url of extractUrlsFromFeedXml(xml, seedUrl)) found.add(url);
    } catch {
      // feed optional
    }
  }
  return [...found];
}
