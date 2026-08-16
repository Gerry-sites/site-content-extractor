import type { ExtractedPage, Frontmatter } from "../types/schemas.js";
import { htmlToMarkdown } from "./turndown.js";
import { serializeMarkdownFile } from "./frontmatter.js";
import { MISSING_DATE, packFolder, type PackFolder } from "../pack/paths.js";
import { upgradeMediaUrl } from "../media/urls.js";

export type MarkdownResult = {
  filename: string;
  relativePath: string;
  content: string;
  frontmatter: Frontmatter;
};

export type ImagePathMap = Map<string, string>;

function applyImagePaths(text: string, imagePaths: ImagePathMap): string {
  let next = text;
  for (const [remote, local] of imagePaths) {
    next = next.split(remote).join(local);
  }
  return next.replace(/https?:\/\/[^\s"'<>]+/g, (url) => {
    return imagePaths.get(url) || imagePaths.get(upgradeMediaUrl(url)) || url;
  });
}

function fallbackDescription(page: ExtractedPage): string {
  const fromField = page.description?.replace(/\s+/g, " ").trim();
  if (fromField) return fromField;
  const fromBody = page.textContent?.replace(/\s+/g, " ").trim();
  if (fromBody) return fromBody.slice(0, 180);
  return page.title || "Untitled";
}

function fallbackDate(page: ExtractedPage): string {
  const raw = page.date || page.blog?.date;
  if (!raw) return MISSING_DATE;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return MISSING_DATE;
  return parsed.toISOString().slice(0, 10);
}

export function generateMarkdown(
  page: ExtractedPage,
  imagePaths: ImagePathMap,
  options: { skipBlog?: boolean } = {},
): MarkdownResult {
  const html = applyImagePaths(page.htmlContent, imagePaths);

  let body = htmlToMarkdown(html);
  body = applyImagePaths(body, imagePaths);

  const folder: PackFolder = packFolder(page.kind, page.isBlogPost, options.skipBlog);

  const galleryLocals =
    page.galleries[0]?.images
      .map((src) => imagePaths.get(src))
      .filter((x): x is string => Boolean(x)) ?? [];

  if (galleryLocals.length >= 3) {
    for (const local of galleryLocals) {
      const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n*`, "g"), "");
    }
    body = body.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  if (page.videos.length) {
    body += "\n## Videos\n\n";
    for (const video of page.videos) {
      const label = video.title || video.provider || "Video";
      body += `- [${label}](${video.src})\n`;
    }
    body += "\n";
  }

  if (page.files.length) {
    body += "\n## Downloads\n\n";
    for (const file of page.files) {
      body += `- [${file.text || file.filename || "Download"}](${file.href})\n`;
    }
    body += "\n";
  }

  const heroLocal = page.heroImage ? imagePaths.get(page.heroImage) : undefined;

  const frontmatter: Frontmatter = {
    title: page.title || "Untitled",
    description: fallbackDescription(page),
    slug: page.slug,
    date: fallbackDate(page),
    sourceUrl: page.url,
    heroImage: heroLocal || undefined,
  };

  if (page.isBlogPost && page.blog && !options.skipBlog) {
    frontmatter.author = page.blog.author;
    frontmatter.categories = page.blog.categories.length ? page.blog.categories : undefined;
    frontmatter.tags = page.blog.tags.length ? page.blog.tags : undefined;
  }

  if (galleryLocals.length >= 1) {
    frontmatter.gallery = galleryLocals;
    if (!frontmatter.heroImage) frontmatter.heroImage = galleryLocals[0];
  }

  const content = serializeMarkdownFile(frontmatter, body);
  const filename = `${page.slug}.md`;

  return {
    filename,
    relativePath: `${folder}/${filename}`,
    content,
    frontmatter,
  };
}
