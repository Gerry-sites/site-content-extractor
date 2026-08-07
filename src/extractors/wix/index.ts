import type { PlatformExtractor } from "../types.js";
import { genericExtractor } from "../generic/index.js";
import {
  extractDescription,
  extractHeadings,
  extractTitle,
  loadDocument,
  removeChrome,
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
import {
  extractNavigation,
  extractSiteMetadata,
} from "../shared/metadata.js";
import { pathFromUrl } from "../../utils/url.js";
import { toSlug } from "../../utils/slug.js";
import type { ExtractedPage } from "../../types/schemas.js";

const WIX_HINTS = [
  "wix.com",
  "static.wixstatic.com",
  "parastorage.com",
  "wix-code",
  "X-Wix-",
  "data-mesh-id",
  "WixStatic",
  "_wix_browser_sess",
  "thunderbolt",
];

function scoreWix(html: string, url: string): number {
  let score = 0;
  const lower = html.toLowerCase();
  for (const hint of WIX_HINTS) {
    if (lower.includes(hint.toLowerCase())) score += 0.15;
  }
  if (/static\.wixstatic\.com/i.test(html)) score += 0.25;
  if (/<meta[^>]+name=["']generator["'][^>]+wix/i.test(html)) score += 0.5;
  if (/\.wixsite\.com/i.test(url)) score += 0.4;
  return Math.min(score, 1);
}

export const wixExtractor: PlatformExtractor = {
  id: "wix",
  name: "Wix",

  detect(ctx) {
    return scoreWix(ctx.html, ctx.url);
  },

  async extractPage(ctx): Promise<ExtractedPage> {
    const $ = loadDocument(ctx.html);
    const title = extractTitle($);
    const description = extractDescription($);

    // Wix-specific chrome removal before generic chrome removal
    $(
      [
        "#SITE_HEADER",
        "#SITE_FOOTER",
        "#WIX_ADS",
        ".wix-ads",
        "[data-testid='TINY_MENU']",
        "[id*='comp-'][class*='hidden']",
        "wix-iframe",
        "#SCROLL_TO_TOP",
        "#SCROLL_TO_BOTTOM",
        "[data-hook='cookie-consent-banner']",
      ].join(","),
    ).remove();
    removeChrome($);

    // Prefer Wix page containers
    const candidates = [
      "#SITE_PAGES",
      "#PAGES_CONTAINER",
      "[data-testid='page']",
      "main",
      "[role='main']",
      "#site-root",
    ];

    let mainHtml = "";
    for (const selector of candidates) {
      const el = $(selector).first();
      if (el.length && el.text().trim().length > 40) {
        mainHtml = $.html(el) || "";
        break;
      }
    }
    if (!mainHtml) {
      // Fall back to generic extractor content selection
      const generic = await genericExtractor.extractPage(ctx);
      return { ...generic };
    }

    const $main = loadDocument(`<div id="__main">${mainHtml}</div>`);

    // Promote Wix background images into <img> for markdown conversion
    $main("[data-src], [data-pin-media]").each((_, el) => {
      const src =
        $main(el).attr("data-src") || $main(el).attr("data-pin-media");
      if (src && !$main(el).attr("src")) {
        $main(el).attr("src", src);
      }
    });

    const images = extractImages($main, ctx.url);
    const pageImages = extractImages($, ctx.url);
    const mergedImages = [...images];
    for (const img of pageImages) {
      if (!mergedImages.some((m) => m.src === img.src)) mergedImages.push(img);
    }

    const links = extractLinks($main, ctx.url, ctx.seedUrl);
    const videos = extractVideos($main, ctx.url);
    const files = extractFiles($main, ctx.url);
    const galleries = detectGalleries($main, ctx.url);
    // Wix pro-gallery often outside cleaned main
    const pageGalleries = detectGalleries($, ctx.url);
    for (const g of pageGalleries) {
      if (!galleries.some((x) => x.images[0] === g.images[0])) {
        galleries.push(g);
      }
    }

    const headings = extractHeadings($main);
    const heroImage = pickHeroImage($, ctx.url, mergedImages);
    const isBlog =
      looksLikeBlogPost(ctx.url, $) ||
      /\/post\//i.test(ctx.url) ||
      $("[data-testid='blogPost']").length > 0 ||
      $(".blog-post-content").length > 0;

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
      images: mergedImages,
      links,
      videos,
      files,
      galleries,
      isBlogPost: isBlog,
      kind: isBlog ? "blog" : galleries.length >= 1 && headings.length <= 1 ? "gallery" : "page",
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
    const nav = extractNavigation($, ctx.url, ctx.seedUrl);
    if (nav.length) return nav;

    // Wix menus often use nested spans
    const items: typeof nav = [];
    const seen = new Set<string>();
    $("#SITE_HEADER a[href], [data-testid='linkElement']").each((_, el) => {
      const href = $(el).attr("href");
      const title = $(el).text().replace(/\s+/g, " ").trim();
      if (!href || !title) return;
      try {
        const url = new URL(href, ctx.url);
        if (url.origin !== new URL(ctx.seedUrl).origin) return;
        const path = url.pathname || "/";
        const key = `${title}|${path}`;
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ title, url: path });
      } catch {
        // ignore
      }
    });
    return items;
  },

  async extractMetadata(ctx) {
    const $ = loadDocument(ctx.html);
    return extractSiteMetadata($, ctx.url);
  },
};
