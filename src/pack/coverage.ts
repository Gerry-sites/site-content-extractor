import type { DiscoveredPage, ExtractedPage } from "../types/schemas.js";
import { isLowValueCrawlUrl } from "../crawler/seeds.js";
import { isSkippableAsset, upgradeMediaUrl } from "../media/urls.js";

export type SeedMissing = {
  path: string;
  status?: number;
};

export type Coverage = {
  discovered: number;
  withHtml: number;
  missingHtml: string[];
  missingMarkdown: string[];
  missingImages: string[];
  leftoverRemote: string[];
  seedMissing: SeedMissing[];
};

export function coverageHasHoles(coverage: Coverage): boolean {
  return (
    coverage.missingHtml.length > 0 ||
    coverage.missingMarkdown.length > 0 ||
    coverage.missingImages.length > 0 ||
    coverage.leftoverRemote.length > 0
  );
}

export function missingHtmlUrls(
  pages: DiscoveredPage[],
  htmlByUrl: Map<string, string>,
): string[] {
  return pages
    .filter((page) => {
      if (htmlByUrl.has(page.normalizedUrl)) return false;
      if (isLowValueCrawlUrl(page.normalizedUrl)) return false;
      if (page.status && page.status >= 400) return false;
      return true;
    })
    .map((page) => page.normalizedUrl);
}

export function missingMarkdownUrls(
  extracted: ExtractedPage[],
  writtenByUrl: Map<string, string>,
): string[] {
  return extracted.filter((page) => !writtenByUrl.has(page.url)).map((page) => page.url);
}

export function missingImageUrls(
  extracted: ExtractedPage[],
  imagePathMap: Map<string, string>,
  broken: Set<string>,
): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const page of extracted) {
    const urls = [
      ...(page.heroImage ? [page.heroImage] : []),
      ...page.images.map((img) => img.src),
      ...page.galleries.flatMap((gallery) => gallery.images),
    ];
    for (const url of urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (isSkippableAsset(url)) continue;
      const upgraded = upgradeMediaUrl(url);
      if (imagePathMap.has(url) || imagePathMap.has(upgraded)) continue;
      if (broken.has(url) || broken.has(upgraded)) {
        missing.push(url);
        continue;
      }
      missing.push(url);
    }
  }
  return missing;
}

const REMOTE_IMG = /https?:\/\/[^\s"'<>)]+/g;

export function leftoverRemoteUrls(markdown: string): string[] {
  const found: string[] = [];
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const src = match[1]?.trim().split(/\s+/)[0];
    if (src && /^https?:\/\//i.test(src) && !isSkippableAsset(src)) {
      found.push(src);
    }
  }
  for (const url of markdown.match(REMOTE_IMG) ?? []) {
    if (isSkippableAsset(url)) continue;
    if (/wixstatic|wp\.com|wp-content|wordpress\.com|\/v1\/fill\//i.test(url)) {
      if (!found.includes(url)) found.push(url);
    }
  }
  return found;
}

export function buildCoverage(input: {
  pages: DiscoveredPage[];
  htmlByUrl: Map<string, string>;
  extracted: ExtractedPage[];
  writtenByUrl: Map<string, string>;
  imagePathMap: Map<string, string>;
  brokenImages: string[];
  markdownContents: string[];
  seedMissing: SeedMissing[];
  skipImages?: boolean;
}): Coverage {
  const leftoverRemote = [
    ...new Set(input.markdownContents.flatMap((content) => leftoverRemoteUrls(content))),
  ];
  return {
    discovered: input.pages.length,
    withHtml: input.htmlByUrl.size,
    missingHtml: missingHtmlUrls(input.pages, input.htmlByUrl),
    missingMarkdown: missingMarkdownUrls(input.extracted, input.writtenByUrl),
    missingImages: input.skipImages
      ? []
      : missingImageUrls(input.extracted, input.imagePathMap, new Set(input.brokenImages)),
    leftoverRemote,
    seedMissing: input.seedMissing,
  };
}
