import type { PlatformExtractor } from "../types.js";
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
import { extractNavigation, extractSiteMetadata } from "../shared/metadata.js";
import { pathFromUrl } from "../../utils/url.js";
import { toSlug } from "../../utils/slug.js";
import type { ExtractedPage } from "../../types/schemas.js";

export const genericExtractor: PlatformExtractor = {
  id: "generic",
  name: "Generic HTML",

  detect() {
    return 0.1;
  },

  async extractPage(ctx): Promise<ExtractedPage> {
    const $ = loadDocument(ctx.html);
    const title = extractTitle($);
    const description = extractDescription($);
    removeChrome($);

    const main = selectMainContent($);
    const mainHtml = $.html(main) || "";

    // Re-parse main fragment for media scoped to content where possible
    const $main = loadDocument(`<div id="__main">${mainHtml}</div>`);
    const images = extractImages($main, ctx.url);
    const links = extractLinks($main, ctx.url, ctx.seedUrl);
    const videos = extractVideos($main, ctx.url);
    const files = extractFiles($main, ctx.url);
    const galleries = detectGalleries($main, ctx.url);
    const headings = extractHeadings($main);
    const heroImage = pickHeroImage($, ctx.url, images);

    const isBlog = looksLikeBlogPost(ctx.url, $);
    const slug = toSlug(pathFromUrl(ctx.url), "page");

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
      kind: isBlog ? "blog" : galleries.length && !headings.length ? "gallery" : "page",
    };

    if (isBlog) {
      page.blog = {
        ...extractBlogMeta($, title, ctx.url),
        heroImage,
      };
      if (page.blog.slug) page.slug = page.blog.slug;
    }

    return page;
  },

  async extractNavigation(ctx) {
    const $ = loadDocument(ctx.html);
    return extractNavigation($, ctx.url, ctx.seedUrl);
  },

  async extractMetadata(ctx) {
    const $ = loadDocument(ctx.html);
    return extractSiteMetadata($, ctx.url);
  },
};
