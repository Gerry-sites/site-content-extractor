import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe[src*='googletagmanager']",
  "iframe[src*='facebook.com/plugins']",
  "iframe[src*='doubleclick']",
  ".cookie-banner",
  ".cookie-consent",
  "#cookie-banner",
  "#cookieConsent",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='Cookie']",
  ".popup",
  ".modal",
  "[class*='popup']",
  "[class*='modal']",
  "[role='dialog']",
  "nav",
  "header",
  "footer",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".wix-ads",
  "#SITE_HEADER",
  "#SITE_FOOTER",
  "#WIX_ADS",
  ".sqs-announcement-bar",
  ".Header",
  ".Footer",
];

const MAIN_CANDIDATES = [
  "main",
  "article",
  "[role='main']",
  "#content",
  ".content",
  "#main",
  ".main",
  "#SITE_PAGES",
  ".SITE_PAGES",
  "[data-testid='page']",
  ".wixui-rich-text",
  ".blog-post",
  ".blog-post-content",
  ".post-content",
  ".entry-content",
  ".sqs-layout",
  ".w-richtext",
];

export function loadDocument(html: string) {
  return cheerio.load(html);
}

export function removeChrome($: cheerio.CheerioAPI): void {
  for (const selector of REMOVE_SELECTORS) {
    $(selector).remove();
  }
  // Wix Pro Gallery hides off-screen tiles with aria-hidden. Keep those imgs.
  $("[aria-hidden='true']").each((_, el) => {
    const node = $(el);
    const srcs = node
      .find("img")
      .toArray()
      .map((img) => $(img).attr("src") || $(img).attr("data-src") || "");
    const hasContentImage = srcs.some(
      (src) => src && !src.startsWith("data:") && !/\/v1\/fill\/w_1[0-9],h_1[0-9]/.test(src),
    );
    if (hasContentImage) return;
    node.remove();
  });
}

export function selectMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> {
  for (const selector of MAIN_CANDIDATES) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 40) {
      return el;
    }
  }

  // Fallback: largest text-bearing block under body
  let best: cheerio.Cheerio<AnyNode> | null = null;
  let bestScore = 0;
  $("body *").each((_, el) => {
    const node = $(el);
    const tag = (el as Element).tagName?.toLowerCase();
    if (!tag || ["script", "style", "noscript"].includes(tag)) return;
    const text = node.text().replace(/\s+/g, " ").trim();
    const score = text.length;
    if (score > bestScore && score > 80) {
      bestScore = score;
      best = node;
    }
  });

  return best ?? $("body");
}

export function extractTitle($: cheerio.CheerioAPI, fallback = "Untitled"): string {
  const og = $('meta[property="og:title"]').attr("content")?.trim();
  if (og) return og;
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;
  const title = $("title").first().text().trim();
  if (title) return title.replace(/\s*[|\-–—].*$/, "").trim() || title;
  return fallback;
}

export function extractDescription($: cheerio.CheerioAPI): string | undefined {
  const og = $('meta[property="og:description"]').attr("content")?.trim();
  if (og) return og;
  const meta = $('meta[name="description"]').attr("content")?.trim();
  return meta || undefined;
}

export function extractHeadings($: cheerio.CheerioAPI): string[] {
  const headings: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  });
  return headings;
}
