import type { CheerioAPI } from "cheerio";
import type {
  ExtractedFile,
  ExtractedImage,
  ExtractedLink,
  ExtractedVideo,
  Gallery,
} from "../../types/schemas.js";
import { isInternalLink, toAbsoluteUrl, isImageUrl } from "../../utils/url.js";
import { isSkippableAsset, upgradeMediaUrl } from "../../media/urls.js";

function resolveImageSrc(src: string, pageUrl: string): string | undefined {
  const absolute = toAbsoluteUrl(src, pageUrl);
  if (!absolute || isSkippableAsset(absolute)) return undefined;
  return upgradeMediaUrl(absolute);
}

export function extractImages($: CheerioAPI, pageUrl: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src") ||
      $(el).attr("data-original");
    if (!src || src.startsWith("data:")) return;

    const absolute = resolveImageSrc(src, pageUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);

    const width = Number($(el).attr("width")) || undefined;
    const height = Number($(el).attr("height")) || undefined;
    images.push({
      src: absolute,
      alt: $(el).attr("alt")?.trim() || undefined,
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
      role: "content",
    });
  });

  // CSS background images in style attributes (common on Wix)
  $("[style*='background']").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const match = style.match(/url\(["']?([^"')]+)["']?\)/i);
    if (!match?.[1] || match[1].startsWith("data:")) return;
    const absolute = resolveImageSrc(match[1], pageUrl);
    if (!absolute || seen.has(absolute) || !isImageUrl(absolute)) return;
    seen.add(absolute);
    images.push({ src: absolute, role: "content" });
  });

  return images;
}

export function extractLinks($: CheerioAPI, pageUrl: string, seedUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    links.push({
      href: absolute,
      text: $(el).text().replace(/\s+/g, " ").trim() || undefined,
      internal: isInternalLink(absolute, seedUrl),
    });
  });

  return links;
}

export function extractVideos($: CheerioAPI, pageUrl: string): ExtractedVideo[] {
  const videos: ExtractedVideo[] = [];
  const seen = new Set<string>();

  $("video source, video").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const absolute = toAbsoluteUrl(src, pageUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    videos.push({ src: absolute, provider: "html5" });
  });

  $("iframe[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const absolute = toAbsoluteUrl(src, pageUrl);
    if (!absolute || seen.has(absolute)) return;
    const lower = absolute.toLowerCase();
    let provider: string | undefined;
    if (lower.includes("youtube") || lower.includes("youtu.be")) provider = "youtube";
    else if (lower.includes("vimeo")) provider = "vimeo";
    else if (lower.includes("wistia")) provider = "wistia";
    if (!provider) return;
    seen.add(absolute);
    videos.push({
      src: absolute,
      provider,
      title: $(el).attr("title")?.trim() || undefined,
    });
  });

  return videos;
}

export function extractFiles($: CheerioAPI, pageUrl: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const seen = new Set<string>();
  const fileExt = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt|mp3|mp4|webm)(?:$|\?)/i;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !fileExt.test(href)) return;
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    const filename = decodeURIComponent(new URL(absolute).pathname.split("/").pop() || "download");
    files.push({
      href: absolute,
      text: $(el).text().replace(/\s+/g, " ").trim() || undefined,
      filename,
    });
  });

  return files;
}

export function detectGalleries($: CheerioAPI, pageUrl: string): Gallery[] {
  const galleries: Gallery[] = [];

  const gallerySelectors = [
    "[class*='gallery']",
    "[class*='Gallery']",
    "[data-testid*='gallery']",
    ".pro-gallery",
    ".wixui-gallery",
    ".sqs-gallery",
    ".w-slider",
    "ul.gallery",
  ];

  for (const selector of gallerySelectors) {
    $(selector).each((_, el) => {
      const images: string[] = [];
      $(el)
        .find("img")
        .each((__, img) => {
          const src = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-lazy-src");
          if (!src || src.startsWith("data:")) return;
          const absolute = resolveImageSrc(src, pageUrl);
          if (absolute && !images.includes(absolute)) images.push(absolute);
        });
      if (images.length >= 3) {
        galleries.push({
          title: $(el).attr("aria-label") || $(el).find("h2,h3").first().text().trim() || undefined,
          images,
        });
      }
    });
  }

  return galleries;
}

export function pickHeroImage(
  $: CheerioAPI,
  pageUrl: string,
  images: ExtractedImage[],
): string | undefined {
  const og = $('meta[property="og:image"]').attr("content");
  if (og) {
    const absolute = toAbsoluteUrl(og, pageUrl);
    if (absolute) return absolute;
  }
  const heroCandidate = images.find(
    (img) =>
      (img.width && img.width >= 800) ||
      /hero|banner|cover|featured/i.test(img.src) ||
      /hero|banner|cover|featured/i.test(img.alt ?? ""),
  );
  return heroCandidate?.src ?? images[0]?.src;
}
