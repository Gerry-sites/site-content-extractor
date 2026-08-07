import { chromium, type Browser, type Page } from "playwright";
import pLimit from "p-limit";
import type { CliOptions } from "../types/config.js";
import type { DiscoveredPage, PagesManifest } from "../types/schemas.js";
import { PagesManifestSchema } from "../types/schemas.js";
import {
  isAssetUrl,
  isInternalLink,
  normalizeUrl,
  toAbsoluteUrl,
} from "../utils/url.js";
import { writeJson, readJson, exists, ensureDir } from "../utils/fs.js";
import type { Logger } from "../utils/log.js";
import { loadRobots } from "./robots.js";
import { fetchSitemapUrls } from "./sitemap.js";
import path from "node:path";

export type CrawlResult = {
  manifest: PagesManifest;
  htmlByUrl: Map<string, string>;
};

export type CrawlerOptions = Pick<
  CliOptions,
  | "url"
  | "output"
  | "depth"
  | "headless"
  | "resume"
  | "respectRobots"
  | "concurrency"
  | "timeoutMs"
  | "userAgent"
  | "verbose"
>;

export async function crawlSite(
  options: CrawlerOptions,
  logger: Logger,
): Promise<CrawlResult> {
  const seedUrl = normalizeUrl(options.url);
  const manifestPath = path.join(options.output, "pages.json");
  const htmlByUrl = new Map<string, string>();

  const queue: Array<{ url: string; depth: number; source: DiscoveredPage["source"] }> =
    [];
  const discovered = new Map<string, DiscoveredPage>();

  if (options.resume && (await exists(manifestPath))) {
    const existing = PagesManifestSchema.parse(await readJson(manifestPath));
    for (const page of existing.pages) {
      discovered.set(page.normalizedUrl, page);
      queue.push({
        url: page.normalizedUrl,
        depth: page.depth,
        source: "resume",
      });
    }
    logger.info(`Resuming with ${discovered.size} pages from pages.json`);
  } else {
    queue.push({ url: seedUrl, depth: 0, source: "seed" });
    discovered.set(seedUrl, {
      url: seedUrl,
      normalizedUrl: seedUrl,
      depth: 0,
      source: "seed",
    });
  }

  const robots = await loadRobots(seedUrl, options.userAgent);
  if (options.respectRobots) {
    logger.debug("Loaded robots.txt rules");
  }

  // Seed from sitemaps
  for (const sitemapUrl of robots.sitemaps) {
    const urls = await fetchSitemapUrls(sitemapUrl, options.userAgent);
    logger.info(`Sitemap ${sitemapUrl}: ${urls.length} URLs`);
    for (const raw of urls) {
      if (!isInternalLink(raw, seedUrl) || isAssetUrl(raw)) continue;
      const normalized = normalizeUrl(raw, seedUrl);
      if (discovered.has(normalized)) continue;
      if (options.respectRobots && !robots.isAllowed(normalized)) continue;
      discovered.set(normalized, {
        url: raw,
        normalizedUrl: normalized,
        depth: 1,
        source: "sitemap",
      });
      queue.push({ url: normalized, depth: 1, source: "sitemap" });
    }
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: options.headless });
    const context = await browser.newContext({
      userAgent: options.userAgent,
      javaScriptEnabled: true,
    });
    context.setDefaultTimeout(options.timeoutMs);

    const limit = pLimit(options.concurrency);
    const pending = [...queue];
    const visited = new Set<string>();

    while (pending.length > 0) {
      const batch = pending.splice(0, options.concurrency);
      await Promise.all(
        batch.map((item) =>
          limit(async () => {
            if (visited.has(item.url)) return;
            visited.add(item.url);

            if (options.respectRobots && !robots.isAllowed(item.url)) {
              logger.debug(`Blocked by robots.txt: ${item.url}`);
              return;
            }

            if (item.depth > options.depth) return;

            const page = await context.newPage();
            try {
              const response = await page.goto(item.url, {
                waitUntil: "domcontentloaded",
                timeout: options.timeoutMs,
              });
              // Allow client-rendered content to settle
              await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
              await new Promise((r) => setTimeout(r, 500));

              const status = response?.status();
              const contentType = response?.headers()["content-type"] ?? "";
              const entry = discovered.get(item.url);
              if (entry) {
                entry.status = status;
                entry.contentType = contentType;
              }

              if (status && status >= 400) {
                logger.warn(`HTTP ${status} for ${item.url}`);
                return;
              }
              if (contentType && !contentType.includes("text/html")) {
                return;
              }

              const title = await page.title();
              if (entry) entry.title = title;

              const html = await page.content();
              htmlByUrl.set(item.url, html);

              const links = await collectLinks(page, seedUrl);
              for (const link of links) {
                if (discovered.has(link)) continue;
                if (options.respectRobots && !robots.isAllowed(link)) continue;
                const nextDepth = item.depth + 1;
                if (nextDepth > options.depth) continue;
                discovered.set(link, {
                  url: link,
                  normalizedUrl: link,
                  depth: nextDepth,
                  source: item.source === "navigation" ? "navigation" : "link",
                });
                pending.push({
                  url: link,
                  depth: nextDepth,
                  source: "link",
                });
              }

              logger.info(`Crawled (${visited.size}/${discovered.size}): ${item.url}`);
            } catch (err) {
              logger.warn(
                `Failed to crawl ${item.url}: ${err instanceof Error ? err.message : String(err)}`,
              );
            } finally {
              await page.close();
            }
          }),
        ),
      );
    }

    await context.close();
  } finally {
    await browser?.close();
  }

  const manifest: PagesManifest = {
    seedUrl,
    crawledAt: new Date().toISOString(),
    pages: [...discovered.values()].sort((a, b) =>
      a.normalizedUrl.localeCompare(b.normalizedUrl),
    ),
  };

  await ensureDir(options.output);
  await writeJson(manifestPath, manifest);
  logger.info(`Wrote ${manifest.pages.length} pages to pages.json`);

  return { manifest, htmlByUrl };
}

async function collectLinks(page: Page, seedUrl: string): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (anchors) =>
    anchors.map((a) => (a as HTMLAnchorElement).href),
  );

  const results = new Set<string>();
  for (const href of hrefs) {
    const absolute = toAbsoluteUrl(href, seedUrl);
    if (!absolute) continue;
    if (!isInternalLink(absolute, seedUrl)) continue;
    if (isAssetUrl(absolute)) continue;
    results.add(normalizeUrl(absolute));
  }
  return [...results];
}
