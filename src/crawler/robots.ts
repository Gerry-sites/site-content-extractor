import robotsParser from "robots-parser";

export type RobotsRules = {
  isAllowed: (url: string) => boolean;
  sitemaps: string[];
  raw: string | null;
};

type RobotsParserFn = (
  url: string,
  contents: string,
) => {
  isAllowed: (url: string, userAgent?: string) => boolean | null;
  getSitemaps: () => string[];
};

const parseRobots = robotsParser as unknown as RobotsParserFn;

export async function loadRobots(
  seedUrl: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsRules> {
  const origin = new URL(seedUrl).origin;
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const res = await fetchImpl(robotsUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        isAllowed: () => true,
        sitemaps: [`${origin}/sitemap.xml`],
        raw: null,
      };
    }
    const raw = await res.text();
    const robots = parseRobots(robotsUrl, raw);
    const sitemaps = robots.getSitemaps();
    return {
      isAllowed: (url: string) => robots.isAllowed(url, userAgent) !== false,
      sitemaps: sitemaps.length ? sitemaps : [`${origin}/sitemap.xml`],
      raw,
    };
  } catch {
    return {
      isAllowed: () => true,
      sitemaps: [`${origin}/sitemap.xml`],
      raw: null,
    };
  }
}
