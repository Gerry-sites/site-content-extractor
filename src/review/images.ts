import type { ExtractedImage, ExtractedPage } from "../types/schemas.js";
import { isOtherHost, isSkippableAsset } from "../media/urls.js";

export const TITLE_STOPWORDS = new Set(
  [
    "about",
    "gallery",
    "recipe",
    "the",
    "and",
    "home",
    "page",
    "post",
    "blog",
    "studio",
    "contact",
    "portfolio",
    "photography",
    "photo",
    "work",
    "works",
    "series",
    "for",
    "with",
    "from",
    "this",
    "that",
    "your",
    "our",
    "new",
    "old",
  ].map((w) => w.toLowerCase()),
);

export type ImageReviewFlag = "chrome" | "other-host" | "title-name-in-media" | "inline-blog";

export type ImageReviewEntry = {
  remoteUrl: string;
  pageUrl: string;
  alt?: string;
  sitePath?: string;
  flags: ImageReviewFlag[];
};

const PROPER_NAME = /^[A-Z][A-Za-zÀ-ÿ'-]{2,}$/;

export function titleNameTokens(title: string): string[] {
  return title
    .split(/[\s,:;/|–—-]+/)
    .map((part) => part.trim())
    .filter((part) => PROPER_NAME.test(part))
    .filter((part) => !TITLE_STOPWORDS.has(part.toLowerCase()));
}

export function reviewImage(input: {
  remoteUrl: string;
  pageUrl: string;
  seedUrl: string;
  alt?: string;
  pageTitle: string;
  isBlogPost: boolean;
  isHero: boolean;
  pageKind: string;
}): ImageReviewFlag[] {
  const flags: ImageReviewFlag[] = [];
  if (isSkippableAsset(input.remoteUrl)) flags.push("chrome");
  if (isOtherHost(input.remoteUrl, input.seedUrl)) flags.push("other-host");

  if (input.isBlogPost && input.pageKind !== "gallery") {
    const tokens = titleNameTokens(input.pageTitle);
    const haystack = `${input.alt ?? ""} ${input.remoteUrl}`.toLowerCase();
    if (tokens.some((token) => haystack.includes(token.toLowerCase()))) {
      flags.push("title-name-in-media");
    }
    if (!input.isHero) flags.push("inline-blog");
  }

  return flags;
}

export function reviewExtractedPages(
  pages: ExtractedPage[],
  seedUrl: string,
  sitePaths: Map<string, string>,
): ImageReviewEntry[] {
  const entries: ImageReviewEntry[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const hero = page.heroImage;
    const list: ExtractedImage[] = [...page.images];
    for (const gallery of page.galleries) {
      for (const src of gallery.images) {
        if (!list.some((img) => img.src === src)) {
          list.push({ src, role: "gallery" });
        }
      }
    }
    if (hero && !list.some((img) => img.src === hero)) {
      list.unshift({ src: hero, role: "hero" });
    }

    for (const img of list) {
      const key = `${page.url}|${img.src}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const flags = reviewImage({
        remoteUrl: img.src,
        pageUrl: page.url,
        seedUrl,
        alt: img.alt,
        pageTitle: page.title,
        isBlogPost: page.isBlogPost,
        isHero: img.src === hero || img.role === "hero",
        pageKind: page.kind,
      });
      entries.push({
        remoteUrl: img.src,
        pageUrl: page.url,
        alt: img.alt,
        sitePath: sitePaths.get(img.src),
        flags,
      });
    }
  }

  return entries;
}

export function isSkippedOnImport(
  flags: ImageReviewFlag[],
  options: { includeFlagged?: boolean; flagInlineBlog?: boolean },
): boolean {
  if (options.includeFlagged) return false;
  if (
    flags.includes("chrome") ||
    flags.includes("other-host") ||
    flags.includes("title-name-in-media")
  ) {
    return true;
  }
  if (options.flagInlineBlog !== false && flags.includes("inline-blog")) return true;
  return false;
}
