import type { CheerioAPI } from "cheerio";
import type { BlogPostMeta } from "../../types/schemas.js";
import { toSlug } from "../../utils/slug.js";

const BLOG_URL_HINTS =
  /\/(blog|post|posts|news|article|articles|journal|stories)\b/i;

const BLOG_SELECTORS = [
  "article.blog-post",
  ".blog-post",
  ".post-content",
  ".entry-content",
  "[data-testid='post-content']",
  ".blog-post-page",
  "article.post",
];

export function looksLikeBlogPost(url: string, $: CheerioAPI): boolean {
  if (BLOG_URL_HINTS.test(url)) return true;
  for (const selector of BLOG_SELECTORS) {
    if ($(selector).length) return true;
  }
  const type = $('meta[property="og:type"]').attr("content")?.toLowerCase();
  if (type === "article") return true;
  if ($('meta[property="article:published_time"]').length) return true;
  if ($('script[type="application/ld+json"]').text().includes('"BlogPosting"')) {
    return true;
  }
  return false;
}

export function extractBlogMeta(
  $: CheerioAPI,
  title: string,
  url: string,
): BlogPostMeta {
  let date =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $("time[datetime]").attr("datetime") ||
    $("time").first().text().trim() ||
    undefined;

  let author =
    $('meta[property="article:author"]').attr("content") ||
    $('meta[name="author"]').attr("content") ||
    $("[rel='author']").first().text().trim() ||
    $(".author").first().text().trim() ||
    undefined;

  const categories: string[] = [];
  $('meta[property="article:section"]').each((_, el) => {
    const v = $(el).attr("content")?.trim();
    if (v) categories.push(v);
  });
  $(".category, .categories a, [rel='category']").each((_, el) => {
    const v = $(el).text().trim();
    if (v && !categories.includes(v)) categories.push(v);
  });

  const tags: string[] = [];
  $('meta[property="article:tag"]').each((_, el) => {
    const v = $(el).attr("content")?.trim();
    if (v) tags.push(v);
  });
  $(".tags a, .tag, [rel='tag']").each((_, el) => {
    const v = $(el).text().trim();
    if (v && !tags.includes(v)) tags.push(v);
  });

  // JSON-LD BlogPosting
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || "");
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const graph = node["@graph"] ? node["@graph"] : [node];
        for (const item of graph) {
          if (
            item["@type"] === "BlogPosting" ||
            item["@type"] === "Article" ||
            (Array.isArray(item["@type"]) &&
              item["@type"].some((t: string) =>
                ["BlogPosting", "Article"].includes(t),
              ))
          ) {
            date = date || item.datePublished || item.dateCreated;
            author =
              author ||
              (typeof item.author === "string"
                ? item.author
                : item.author?.name);
            if (item.headline) {
              // prefer JSON-LD headline only if title is weak
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  const pathSlug = url
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean)
    .pop();

  return {
    title,
    date: date ? String(date).slice(0, 32) : undefined,
    author: author?.trim() || undefined,
    categories,
    tags,
    slug: toSlug(pathSlug || title),
  };
}
