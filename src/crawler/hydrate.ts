import type { Page } from "playwright";

const LOAD_MORE_RE = /load more|show more|more posts|see more/i;

export type HydratedImage = {
  src?: string;
  currentSrc?: string;
};

/**
 * Rewrite <img src> to the browser's currentSrc so Cheerio sees hydrated Wix/WP URLs.
 */
export function applyCurrentSrc(html: string, images: HydratedImage[]): string {
  let next = html;
  for (const img of images) {
    const live = img.currentSrc?.trim();
    const original = img.src?.trim();
    if (!live || live.startsWith("data:")) continue;
    if (original && original !== live) {
      next = next.split(`src="${original}"`).join(`src="${live}"`);
      next = next.split(`src='${original}'`).join(`src='${live}'`);
    }
  }
  return next;
}

export function injectResourceImages(html: string, resourceUrls: string[]): string {
  const extras: string[] = [];
  for (const url of resourceUrls) {
    if (!url || url.startsWith("data:")) continue;
    if (!/wixstatic|wp\.com|wp-content|wordpress\.com/i.test(url)) continue;
    if (html.includes(url)) continue;
    extras.push(`<img src="${url}" alt="" data-hydrate-resource="true" />`);
  }
  if (!extras.length) return html;
  return html.replace(/<\/body>/i, `${extras.join("")}</body>`);
}

export function isLoadMoreLabel(text: string): boolean {
  return LOAD_MORE_RE.test(text.replace(/\s+/g, " ").trim());
}

export async function scrollPage(page: Page, steps = 12): Promise<void> {
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight, 400)));
    await new Promise((r) => setTimeout(r, 200));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Poll until image/resource counts stop growing, or `capMs` elapses.
 */
export async function waitForStableImages(page: Page, capMs = 15_000): Promise<void> {
  let last = -1;
  let stableMs = 0;
  const started = Date.now();
  while (Date.now() - started < capMs) {
    const count = await page.evaluate(
      () => document.images.length + performance.getEntriesByType("resource").length,
    );
    if (count === last) {
      stableMs += 400;
      if (stableMs >= 1_000) return;
    } else {
      stableMs = 0;
      last = count;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}
