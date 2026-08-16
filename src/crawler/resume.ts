import type { DiscoveredPage } from "../types/schemas.js";
import { isAssetUrl } from "../utils/url.js";
import { isLowValueCrawlUrl } from "./seeds.js";

export type ResumeQueueItem = {
  url: string;
  depth: number;
  source: DiscoveredPage["source"];
};

/**
 * Keep every previously discovered URL (and every HTML-cache key) in the
 * manifest so --resume cannot shrink the pack. Low-value URLs stay listed;
 * they are not recrawled.
 */
export function rememberResumePages(
  discovered: Map<string, DiscoveredPage>,
  pages: DiscoveredPage[],
  htmlUrls: Iterable<string>,
): void {
  for (const page of pages) {
    discovered.set(page.normalizedUrl, page);
  }
  for (const url of htmlUrls) {
    if (discovered.has(url)) continue;
    discovered.set(url, {
      url,
      normalizedUrl: url,
      depth: 1,
      source: "resume",
    });
  }
}

export function shouldRecrawl(url: string, htmlByUrl: Map<string, string>): boolean {
  if (htmlByUrl.has(url)) return false;
  if (isLowValueCrawlUrl(url) || isAssetUrl(url)) return false;
  return true;
}

export function recrawlQueue(
  discovered: Map<string, DiscoveredPage>,
  htmlByUrl: Map<string, string>,
): ResumeQueueItem[] {
  const queue: ResumeQueueItem[] = [];
  for (const page of discovered.values()) {
    if (!shouldRecrawl(page.normalizedUrl, htmlByUrl)) continue;
    queue.push({
      url: page.normalizedUrl,
      depth: page.depth,
      source: "resume",
    });
  }
  return queue;
}
