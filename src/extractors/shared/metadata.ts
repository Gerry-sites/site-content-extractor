import type { CheerioAPI } from "cheerio";
import type { NavigationItem, SiteMetadata } from "../../types/schemas.js";
import { isInternalLink, toAbsoluteUrl } from "../../utils/url.js";

const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "tiktok.com": "tiktok",
  "pinterest.com": "pinterest",
  "github.com": "github",
  "vimeo.com": "vimeo",
};

export function extractSiteMetadata(
  $: CheerioAPI,
  pageUrl: string,
): SiteMetadata {
  const siteTitle =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    undefined;

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    undefined;

  const canonical =
    $('link[rel="canonical"]').attr("href") ||
    $('meta[property="og:url"]').attr("content") ||
    pageUrl;

  const faviconHref =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    $('link[rel="apple-touch-icon"]').attr("href");

  const logo =
    $('meta[property="og:image"]').attr("content") ||
    $("img[alt*='logo' i]").attr("src") ||
    $("img[class*='logo' i]").attr("src");

  const socialLinks: SiteMetadata["socialLinks"] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, pageUrl);
      const host = url.hostname.replace(/^www\./, "");
      const platform = SOCIAL_HOSTS[host];
      if (!platform || seen.has(platform)) return;
      seen.add(platform);
      socialLinks.push({ platform, url: url.toString() });
    } catch {
      // ignore
    }
  });

  return {
    siteTitle,
    description,
    canonicalUrl: toAbsoluteUrl(canonical, pageUrl) ?? pageUrl,
    favicon: faviconHref
      ? (toAbsoluteUrl(faviconHref, pageUrl) ?? undefined)
      : undefined,
    logo: logo ? (toAbsoluteUrl(logo, pageUrl) ?? undefined) : undefined,
    language: $("html").attr("lang") || undefined,
    socialLinks,
    openGraph: {
      title: $('meta[property="og:title"]').attr("content") || undefined,
      description:
        $('meta[property="og:description"]').attr("content") || undefined,
      image: $('meta[property="og:image"]').attr("content")
        ? (toAbsoluteUrl(
            $('meta[property="og:image"]').attr("content")!,
            pageUrl,
          ) ?? undefined)
        : undefined,
      type: $('meta[property="og:type"]').attr("content") || undefined,
      url: $('meta[property="og:url"]').attr("content") || undefined,
    },
    twitter: {
      card: $('meta[name="twitter:card"]').attr("content") || undefined,
      title: $('meta[name="twitter:title"]').attr("content") || undefined,
      description:
        $('meta[name="twitter:description"]').attr("content") || undefined,
      image: $('meta[name="twitter:image"]').attr("content") || undefined,
      site: $('meta[name="twitter:site"]').attr("content") || undefined,
    },
  };
}

export function extractNavigation(
  $: CheerioAPI,
  pageUrl: string,
  seedUrl: string,
): NavigationItem[] {
  const items: NavigationItem[] = [];
  const seen = new Set<string>();

  const containers = [
    "nav",
    "[role='navigation']",
    "header nav",
    "#SITE_HEADER nav",
    ".Header-nav",
    ".navbar",
    ".menu",
  ];

  let $links = $();
  for (const selector of containers) {
    const found = $(selector).find("a[href]");
    if (found.length) {
      $links = found;
      break;
    }
  }
  if (!$links.length) {
    $links = $("header a[href], #SITE_HEADER a[href]");
  }

  $links.each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!href || !title || title.length > 80) return;
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute || !isInternalLink(absolute, seedUrl)) return;
    let path: string;
    try {
      const u = new URL(absolute);
      path = u.pathname || "/";
      if (!path.endsWith("/") && path !== "/") {
        // keep as-is
      }
    } catch {
      return;
    }
    const key = `${title}|${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ title, url: path === "" ? "/" : path });
  });

  return items;
}
