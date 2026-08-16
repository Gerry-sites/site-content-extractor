import type { PlatformExtractor } from "../types.js";
import { genericExtractor } from "../generic/index.js";
import {
  extractDescription,
  extractHeadings,
  extractTitle,
  loadDocument,
  removeChrome,
  selectMainContent,
} from "../shared/cleanup.js";
import {
  detectGalleries,
  extractFiles,
  extractImages,
  extractLinks,
  extractVideos,
  pickHeroImage,
} from "../shared/media.js";
import { extractBlogMeta, looksLikeBlogPost } from "../shared/blog.js";
import { pathFromUrl } from "../../utils/url.js";
import { toSlug } from "../../utils/slug.js";
import type { ExtractedPage } from "../../types/schemas.js";

function scoreWordpress(html: string, url: string): number {
  let score = 0;
  if (/wp-content/i.test(html)) score += 0.4;
  if (/<meta[^>]+name=["']generator["'][^>]+wordpress/i.test(html)) score += 0.5;
  if (/wordpress\.com/i.test(html) || /wordpress\.com/i.test(url)) score += 0.35;
  if (/\bwp-json\b/i.test(html) || /\/wp-json\//i.test(html)) score += 0.2;
  return Math.min(score, 1);
}

function selectWordpressMain($: ReturnType<typeof loadDocument>) {
  const candidates = [
    "article .entry-content",
    ".entry-content",
    "article.post",
    "article",
    ".post-content",
    ".hentry",
  ];
  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 40) return el;
  }
  return selectMainContent($);
}

export const wordpressExtractor: PlatformExtractor = {
  id: "wordpress",
  name: "WordPress",

  detect(ctx) {
    return scoreWordpress(ctx.html, ctx.url);
  },

  async extractPage(ctx): Promise<ExtractedPage> {
    const $ = loadDocument(ctx.html);
    const title = extractTitle($);
    const description = extractDescription($);
    removeChrome($);

    const main = selectWordpressMain($);
    const mainHtml = $.html(main) || "";
    const $main = loadDocument(`<div id="__main">${mainHtml}</div>`);
    const images = extractImages($main, ctx.url);
    const links = extractLinks($main, ctx.url, ctx.seedUrl);
    const videos = extractVideos($main, ctx.url);
    const files = extractFiles($main, ctx.url);
    const galleries = detectGalleries($main, ctx.url);
    const headings = extractHeadings($main);
    const heroImage = pickHeroImage($, ctx.url, images);

    const path = pathFromUrl(ctx.url);
    const isPagePath = /^\/?(about|contact|manifesto|privacy|legal)\/?$/i.test(path);
    const isBlog =
      !isPagePath && (looksLikeBlogPost(ctx.url, $) || /\/\d{4}\/\d{2}\//.test(ctx.url));
    const slug = toSlug(path, "page");

    const page: ExtractedPage = {
      url: ctx.url,
      title,
      description,
      slug,
      headings,
      htmlContent: mainHtml,
      textContent: $main.text().replace(/\s+/g, " ").trim(),
      heroImage,
      images,
      links,
      videos,
      files,
      galleries,
      isBlogPost: isBlog,
      kind: isBlog ? "blog" : "page",
    };

    if (isBlog) {
      page.blog = {
        ...extractBlogMeta($, title, ctx.url),
        heroImage,
      };
      if (page.blog.slug) page.slug = page.blog.slug;
      if (page.blog.date) page.date = page.blog.date;
    }

    return page;
  },

  extractNavigation: genericExtractor.extractNavigation,
  extractMetadata: genericExtractor.extractMetadata,
};
