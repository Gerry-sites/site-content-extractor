import { chromium, type Browser, type Page } from "playwright";
import pLimit from "p-limit";
import type { CliOptions } from "../types/config.js";
import type { DiscoveredPage, PagesManifest } from "../types/schemas.js";
import { PagesManifestSchema } from "../types/schemas.js";
import { isAssetUrl, isInternalLink, normalizeUrl, toAbsoluteUrl } from "../utils/url.js";
import { writeJson, readJson, exists, ensureDir } from "../utils/fs.js";
import type { Logger } from "../utils/log.js";
import { loadRobots } from "./robots.js";
import { fetchSitemapUrls } from "./sitemap.js";
import path from "node:path";
import { discoveryFeedUrls, extraSeedUrls, isLowValueCrawlUrl } from "./seeds.js";
import { discoverFeedUrls } from "./feeds.js";
import { discoverWordpressPostUrls } from "./wordpress-rest.js";
import {
  applyCurrentSrc,
  injectResourceImages,
  scrollPage,
  waitForStableImages,
} from "./hydrate.js";
import { loadHtmlCache, saveHtmlPage, writeHtmlIndex, type HtmlIndex } from "./html-cache.js";
import { rememberResumePages, recrawlQueue } from "./resume.js";
import type { SeedMissing } from "../pack/coverage.js";

export type CrawlResult = {
  manifest: PagesManifest;
  htmlByUrl: Map<string, string>;
  seedMissing: SeedMissing[];
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
  | "settleMs"
  | "paths"
>;

function enqueue(
  discovered: Map<string, DiscoveredPage>,
  queue: Array<{ url: string; depth: number; source: DiscoveredPage["source"] }>,
  raw: string,
  seedUrl: string,
  depth: number,
  source: DiscoveredPage["source"],
  respectRobots: boolean,
  isAllowed: (url: string) => boolean,
) {
  if (!isInternalLink(raw, seedUrl) || isAssetUrl(raw)) return;
  if (isLowValueCrawlUrl(raw)) return;
  const normalized = normalizeUrl(raw, seedUrl);
  if (discovered.has(normalized)) return;
  if (respectRobots && !isAllowed(normalized)) return;
  discovered.set(normalized, {
    url: raw,
    normalizedUrl: normalized,
    depth,
    source,
  });
  queue.push({ url: normalized, depth, source });
}

export async function crawlSite(options: CrawlerOptions, logger: Logger): Promise<CrawlResult> {
  const seedUrl = normalizeUrl(options.url);
  const manifestPath = path.join(options.output, "pages.json");
  const settleMs = options.settleMs ?? 2_500;
  const extraSeeds = new Set(extraSeedUrls(seedUrl, options.paths));
  const seedMissing: SeedMissing[] = [];

  const queue: Array<{ url: string; depth: number; source: DiscoveredPage["source"] }> = [];
  const discovered = new Map<string, DiscoveredPage>();

  let htmlByUrl = new Map<string, string>();
  let htmlIndex: HtmlIndex = {};
  if (options.resume) {
    const cached = await loadHtmlCache(options.output);
    htmlByUrl = cached.htmlByUrl;
    htmlIndex = cached.index;
  }

  if (options.resume) {
    const existingPages = (await exists(manifestPath))
      ? PagesManifestSchema.parse(await readJson(manifestPath)).pages
      : [];
    rememberResumePages(discovered, existingPages, htmlByUrl.keys());
    queue.push(...recrawlQueue(discovered, htmlByUrl));
    if (discovered.size) {
      logger.info(
        `Resuming with ${discovered.size} pages (${htmlByUrl.size} cached HTML, ${queue.length} to recrawl)`,
      );
    }
  }
  if (!discovered.size) {
    queue.push({ url: seedUrl, depth: 0, source: "seed" });
    discovered.set(seedUrl, {
      url: seedUrl,
      normalizedUrl: seedUrl,
      depth: 0,
      source: "seed",
    });
  }

  const robots = await loadRobots(seedUrl, options.userAgent);
  const isAllowed = (url: string) => robots.isAllowed(url);

  if (options.respectRobots) {
    logger.debug("Loaded robots.txt rules");
  }

  for (const extra of extraSeeds) {
    enqueue(discovered, queue, extra, seedUrl, 1, "seed", options.respectRobots, isAllowed);
  }

  for (const sitemapUrl of robots.sitemaps) {
    const urls = await fetchSitemapUrls(sitemapUrl, options.userAgent);
    logger.info(`Sitemap ${sitemapUrl}: ${urls.length} URLs`);
    for (const raw of urls) {
      enqueue(discovered, queue, raw, seedUrl, 1, "sitemap", options.respectRobots, isAllowed);
    }
  }

  const feedUrls = await discoverFeedUrls(seedUrl, discoveryFeedUrls(seedUrl), options.userAgent);
  for (const raw of feedUrls) {
    enqueue(discovered, queue, raw, seedUrl, 1, "sitemap", options.respectRobots, isAllowed);
  }
  if (feedUrls.length) logger.info(`Feed discovery: ${feedUrls.length} URLs`);

  const restUrls = await discoverWordpressPostUrls(seedUrl, options.userAgent);
  for (const raw of restUrls) {
    enqueue(discovered, queue, raw, seedUrl, 1, "sitemap", options.respectRobots, isAllowed);
  }
  if (restUrls.length) logger.info(`WordPress REST: ${restUrls.length} URLs`);

  const pending = queue.filter((item) => !htmlByUrl.has(item.url));
  if (pending.length === 0) {
    logger.info(`All ${discovered.size} discovered URLs have cached HTML; skipping browser`);
  } else {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: options.headless });
      const context = await browser.newContext({
        userAgent: options.userAgent,
        javaScriptEnabled: true,
      });
      context.setDefaultTimeout(options.timeoutMs);

      const limit = pLimit(options.concurrency);
      const visited = new Set<string>(htmlByUrl.keys());

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
                let response: Awaited<ReturnType<Page["goto"]>> = null;
                let lastError: unknown;
                for (let attempt = 1; attempt <= 3; attempt += 1) {
                  try {
                    response = await page.goto(item.url, {
                      waitUntil: "domcontentloaded",
                      timeout: options.timeoutMs,
                    });
                    lastError = undefined;
                    break;
                  } catch (err) {
                    lastError = err;
                    if (attempt === 3) throw err;
                    await new Promise((r) => setTimeout(r, 1_000 * attempt));
                  }
                }
                if (lastError) throw lastError;

                const status = response?.status();
                const contentType = response?.headers()["content-type"] ?? "";
                const entry = discovered.get(item.url);
                if (entry) {
                  entry.status = status;
                  entry.contentType = contentType;
                }

                if (status && status >= 400) {
                  logger.warn(`HTTP ${status} for ${item.url}`);
                  if (extraSeeds.has(item.url)) {
                    try {
                      seedMissing.push({
                        path: new URL(item.url).pathname,
                        status,
                      });
                    } catch {
                      seedMissing.push({ path: item.url, status });
                    }
                  }
                  return;
                }
                if (contentType && !contentType.includes("text/html")) {
                  return;
                }

                await page
                  .waitForLoadState("networkidle", { timeout: 5_000 })
                  .catch(() => undefined);
                await new Promise((r) => setTimeout(r, settleMs));
                await clickLoadMore(page, 20);
                await scrollPage(page);
                await waitForStableImages(page);

                const title = await page.title();
                if (entry) entry.title = title;

                const html = await hydratePageHtml(page);
                htmlByUrl.set(item.url, html);
                await saveHtmlPage(options.output, item.url, html, htmlIndex);

                const links = await collectLinks(page, seedUrl);
                for (const link of links) {
                  if (discovered.has(link)) continue;
                  if (isLowValueCrawlUrl(link)) continue;
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
  }

  const manifest: PagesManifest = {
    seedUrl,
    crawledAt: new Date().toISOString(),
    pages: [...discovered.values()].sort((a, b) => a.normalizedUrl.localeCompare(b.normalizedUrl)),
  };

  await ensureDir(options.output);
  await writeJson(manifestPath, manifest);
  await writeHtmlIndex(options.output, htmlIndex);
  logger.info(`Wrote ${manifest.pages.length} pages to pages.json`);

  return { manifest, htmlByUrl, seedMissing };
}

async function hydratePageHtml(page: Page): Promise<string> {
  const snapshot = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.getAttribute("src") || undefined,
      currentSrc: (img as HTMLImageElement).currentSrc || undefined,
    }));
    const resources = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /wixstatic|wp\.com|wp-content|wordpress\.com/i.test(name));
    return { imgs, resources };
  });
  let html = await page.content();
  html = applyCurrentSrc(html, snapshot.imgs);
  html = injectResourceImages(html, snapshot.resources);
  return html;
}

async function clickLoadMore(page: Page, maxClicks: number): Promise<void> {
  for (let i = 0; i < maxClicks; i += 1) {
    const clicked = await page.evaluate((reSource) => {
      const re = new RegExp(reSource, "i");
      const candidates = Array.from(
        document.querySelectorAll("button, a, [role='button']"),
      ) as HTMLElement[];
      const target = candidates.find((el) => re.test((el.textContent || "").replace(/\s+/g, " ")));
      if (!target) return false;
      target.click();
      return true;
    }, "load more|show more|more posts|see more");
    if (!clicked) break;
    await new Promise((r) => setTimeout(r, 800));
  }
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
    if (isLowValueCrawlUrl(absolute)) continue;
    results.add(normalizeUrl(absolute));
  }
  return [...results];
}
