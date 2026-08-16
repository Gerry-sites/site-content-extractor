import { normalizeUrl, isInternalLink, isAssetUrl } from "../utils/url.js";

type RestFetch = typeof fetch;

type WpV2Post = {
  link?: string;
};

type WpComPost = {
  URL?: string;
  link?: string;
};

function queueLink(raw: string | undefined, seedUrl: string, into: Set<string>) {
  if (!raw) return;
  if (!isInternalLink(raw, seedUrl) || isAssetUrl(raw)) return;
  into.add(normalizeUrl(raw, seedUrl));
}

/**
 * Discover post URLs from WordPress REST, derived only from the seed origin.
 */
export async function discoverWordpressPostUrls(
  seedUrl: string,
  userAgent: string,
  fetchImpl: RestFetch = fetch,
): Promise<string[]> {
  const found = new Set<string>();
  const origin = new URL(seedUrl).origin;
  const hostname = new URL(seedUrl).hostname.replace(/^www\./, "");

  const fromV2 = await fetchWpV2(origin, seedUrl, userAgent, fetchImpl);
  for (const url of fromV2) found.add(url);
  if (found.size) return [...found];

  const fromCom = await fetchWpCom(hostname, seedUrl, userAgent, fetchImpl);
  for (const url of fromCom) found.add(url);
  return [...found];
}

async function fetchWpV2(
  origin: string,
  seedUrl: string,
  userAgent: string,
  fetchImpl: RestFetch,
): Promise<string[]> {
  const found = new Set<string>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 50) {
    const url = `${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}`;
    try {
      const res = await fetchImpl(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      });
      if (!res.ok) break;
      const headerPages = Number(res.headers.get("X-WP-TotalPages") || "1");
      if (Number.isFinite(headerPages) && headerPages > 0) totalPages = headerPages;
      const posts = (await res.json()) as WpV2Post[];
      if (!Array.isArray(posts) || posts.length === 0) break;
      for (const post of posts) queueLink(post.link, seedUrl, found);
      page += 1;
    } catch {
      break;
    }
  }
  return [...found];
}

async function fetchWpCom(
  hostname: string,
  seedUrl: string,
  userAgent: string,
  fetchImpl: RestFetch,
): Promise<string[]> {
  const found = new Set<string>();
  let offset = 0;
  for (let i = 0; i < 20; i += 1) {
    const url = `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(hostname)}/posts?number=100&offset=${offset}`;
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      });
      if (!res.ok) break;
      const body = (await res.json()) as { posts?: WpComPost[]; found?: number };
      const posts = body.posts ?? [];
      if (!posts.length) break;
      for (const post of posts) queueLink(post.URL || post.link, seedUrl, found);
      offset += posts.length;
      if (typeof body.found === "number" && offset >= body.found) break;
    } catch {
      break;
    }
  }
  return [...found];
}
