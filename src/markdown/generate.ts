import type { ExtractedPage, Frontmatter } from "../types/schemas.js";
import { htmlToMarkdown } from "./turndown.js";
import { serializeMarkdownFile } from "./frontmatter.js";

export type MarkdownResult = {
  filename: string;
  relativePath: string;
  content: string;
  frontmatter: Frontmatter;
};

export type ImagePathMap = Map<string, string>;

export function generateMarkdown(
  page: ExtractedPage,
  imagePaths: ImagePathMap,
  options: { skipBlog?: boolean } = {},
): MarkdownResult {
  let html = page.htmlContent;

  // Rewrite image src attributes to local paths before conversion
  for (const [remote, local] of imagePaths) {
    html = html.split(remote).join(local);
  }

  let body = htmlToMarkdown(html);

  // Rewrite any remaining remote image URLs in markdown
  for (const [remote, local] of imagePaths) {
    body = body.split(remote).join(local);
  }

  // Prefer gallery frontmatter for gallery-heavy pages
  const galleryLocals =
    page.galleries[0]?.images
      .map((src) => imagePaths.get(src))
      .filter((x): x is string => Boolean(x))
      .map((p) => p.replace(/^\.\.\//, "")) ?? [];

  if (galleryLocals.length >= 3) {
    // Strip inline gallery images that are already listed in frontmatter
    for (const local of galleryLocals) {
      const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      body = body.replace(
        new RegExp(`!\\[[^\\]]*\\]\\(\\.?\\.?/?${escaped}\\)\\n*`, "g"),
        "",
      );
    }
    body = body.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  // Append videos as links
  if (page.videos.length) {
    body += "\n## Videos\n\n";
    for (const video of page.videos) {
      const label = video.title || video.provider || "Video";
      body += `- [${label}](${video.src})\n`;
    }
    body += "\n";
  }

  // Append downloadable files
  if (page.files.length) {
    body += "\n## Downloads\n\n";
    for (const file of page.files) {
      body += `- [${file.text || file.filename || "Download"}](${file.href})\n`;
    }
    body += "\n";
  }

  const heroLocal = page.heroImage
    ? imagePaths.get(page.heroImage)
    : undefined;

  const frontmatter: Frontmatter = {
    title: page.title || "Untitled",
    description: page.description,
    slug: page.slug,
    heroImage: heroLocal?.replace(/^\.\.\//, "") || undefined,
  };

  if (page.isBlogPost && page.blog && !options.skipBlog) {
    frontmatter.date = page.blog.date;
    frontmatter.author = page.blog.author;
    frontmatter.categories = page.blog.categories.length
      ? page.blog.categories
      : undefined;
    frontmatter.tags = page.blog.tags.length ? page.blog.tags : undefined;
  }

  if (galleryLocals.length >= 3) {
    frontmatter.gallery = galleryLocals;
  }

  const content = serializeMarkdownFile(frontmatter, body);
  const folder =
    page.isBlogPost && !options.skipBlog
      ? "blog"
      : page.kind === "portfolio" || page.kind === "gallery"
        ? "portfolio"
        : "pages";
  const filename = `${page.slug}.md`;

  return {
    filename,
    relativePath: `${folder}/${filename}`,
    content,
    frontmatter,
  };
}
