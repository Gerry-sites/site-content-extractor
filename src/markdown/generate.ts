import type { ExtractedPage, Frontmatter } from "../types/schemas.js";
import { htmlToMarkdown } from "./turndown.js";
import { serializeMarkdownFile } from "./frontmatter.js";
import { MISSING_DATE, packFolder, type PackFolder } from "../pack/paths.js";
import { stripSkippableImages, upgradeMediaUrl } from "../media/urls.js";
import {
  cleanMarkdownBody,
  polishDescription,
  polishTitle,
  stripLocalImageEmbeds,
  stripTitleSuffix,
  stripYearHeadings,
  yearFromHeadings,
  localImagePaths,
} from "./cleanup.js";
import { galleryItemSrc, type GalleryEntry } from "../pack/gallery.js";

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
  next = next.replace(/https?:\/\/[^\s"'<>]+/g, (url) => {
    return imagePaths.get(url) || imagePaths.get(upgradeMediaUrl(url)) || url;
  });
  return next.replace(/(\/images\/[^\s"'<>?]+)\?[^"'<>)\s]*/g, "$1");
}

function fallbackDate(page: ExtractedPage, body: string): string {
  const raw = page.date || page.blog?.date;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  const headingBlob = (page.headings ?? []).map((heading) => `## ${heading}`).join("\n");
  const fromHeading =
    yearFromHeadings(body) ||
    yearFromHeadings(headingBlob) ||
    yearFromHeadings(page.textContent ?? "");
  if (fromHeading) return fromHeading;
  if (/^\d{4}$/.test(page.slug)) return `${page.slug}-01-01`;
  return MISSING_DATE;
}

function uniqueLocals(paths: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of paths) {
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out;
}

function imageMetaForLocal(
  local: string,
  page: ExtractedPage,
  imagePaths: ImagePathMap,
): { title?: string; caption?: string } | undefined {
  const img = page.images.find((image) => {
    const mapped = imagePaths.get(image.src) || imagePaths.get(upgradeMediaUrl(image.src));
    return mapped === local;
  });
  if (!img || (!img.title && !img.caption)) return undefined;
  return { title: img.title, caption: img.caption };
}

function galleryEntriesForLocals(
  locals: string[],
  page: ExtractedPage,
  imagePaths: ImagePathMap,
): GalleryEntry[] {
  return locals.map((local) => {
    const meta = imageMetaForLocal(local, page, imagePaths);
    if (!meta) return local;
    return {
      src: local,
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.caption ? { caption: meta.caption } : {}),
    };
  });
}

export function generateMarkdown(
  page: ExtractedPage,
  imagePaths: ImagePathMap,
  options: { skipBlog?: boolean } = {},
): MarkdownResult {
  const cleaned = stripSkippableImages(page.htmlContent);
  const html = applyImagePaths(cleaned, imagePaths);

  let body = htmlToMarkdown(html);
  body = applyImagePaths(body, imagePaths);
  body = cleanMarkdownBody(body, stripTitleSuffix(page.title || ""));

  const folder: PackFolder = packFolder(page.kind, page.isBlogPost, options.skipBlog);

  const galleryLocals = uniqueLocals(
    (page.galleries ?? []).flatMap((gallery) =>
      gallery.images.map((src) => imagePaths.get(src) || imagePaths.get(upgradeMediaUrl(src))),
    ),
  );
  const includeBodyImages =
    galleryLocals.length > 0 || page.kind === "gallery" || page.kind === "portfolio";
  const allLocals = includeBodyImages
    ? uniqueLocals([...galleryLocals, ...localImagePaths(body)])
    : galleryLocals;

  const heroLocal =
    (page.heroImage &&
      (imagePaths.get(page.heroImage) || imagePaths.get(upgradeMediaUrl(page.heroImage)))) ||
    allLocals[0];
  const heroMeta = heroLocal ? imageMetaForLocal(heroLocal, page, imagePaths) : undefined;
  const galleryForMatter = galleryEntriesForLocals(
    allLocals.filter((src) => src !== heroLocal),
    page,
    imagePaths,
  );

  if (allLocals.length >= 1) {
    body = stripLocalImageEmbeds(body, allLocals);
  }

  if (page.videos.length) {
    body += "\n\n## Videos\n\n";
    for (const video of page.videos) {
      const label = video.title || video.provider || "Video";
      body += `- [${label}](${video.src})\n`;
    }
  }

  if (page.files.length) {
    body += "\n\n## Downloads\n\n";
    for (const file of page.files) {
      body += `- [${file.text || file.filename || "Download"}](${file.href})\n`;
    }
  }

  body = body.replace(/\n{3,}/g, "\n\n").trim();

  const title = polishTitle(page.title || "Untitled");
  const frontmatter: Frontmatter = {
    title,
    description: polishDescription(page.description, body, title),
    slug: page.slug,
    sourceUrl: page.url,
    heroImage: heroLocal || undefined,
  };
  if (heroMeta?.title) frontmatter.heroTitle = heroMeta.title;
  if (heroMeta?.caption) frontmatter.heroCaption = heroMeta.caption;

  if (folder !== "pages") {
    frontmatter.date = fallbackDate(page, body);
    body = stripYearHeadings(body);
  }

  if (page.isBlogPost && page.blog && !options.skipBlog) {
    frontmatter.author = page.blog.author;
    frontmatter.categories = page.blog.categories.length ? page.blog.categories : undefined;
    frontmatter.tags = page.blog.tags.length ? page.blog.tags : undefined;
  }

  if (galleryForMatter.length >= 1) {
    frontmatter.gallery = galleryForMatter;
    if (!frontmatter.heroImage) frontmatter.heroImage = galleryItemSrc(galleryForMatter[0]);
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
