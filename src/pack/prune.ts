import path from "node:path";
import { copyFile, readdir, readFile } from "node:fs/promises";
import { parseFrontmatter, serializeMarkdownFile } from "../markdown/frontmatter.js";
import type { Frontmatter } from "../types/schemas.js";
import { exists, ensureDir, readJson, resetDir, writeJson, writeText } from "../utils/fs.js";
import type { ImageReviewEntry } from "../review/images.js";
import { packFileFromSitePath, type PackFolder } from "./paths.js";
import type { ImageManifestEntry } from "./identity.js";
import { wordpressOriginalUrl } from "../media/urls.js";
import { asGalleryEntries, galleryItemSrc } from "./gallery.js";
import {
  cleanMarkdownBody,
  firstProseParagraph,
  galleryWithoutHero,
  isSocialOrMailHref,
  localImagePaths,
  polishDescription,
  polishTitle,
  stripLocalImageEmbeds,
  stripTitleSuffix,
  stripYearHeadings,
  yearFromHeadings,
} from "../markdown/cleanup.js";

export type PlatformFamily = "wix" | "wordpress" | "generic";

export type PruneDecision = {
  slug: string;
  from: string;
  keep: boolean;
  folder?: PackFolder;
  reason: string;
};

export type PruneSummary = {
  platform: PlatformFamily;
  source: string;
  output: string;
  kept: Array<{ from: string; to: string }>;
  dropped: Array<{ from: string; reason: string }>;
  imagesCopied: number;
  imagesSkippedFlagged: number;
};

const FOLDERS: PackFolder[] = ["pages", "blog", "portfolio"];
const PROTECTED = new Set(["home", "about", "contact"]);
const DRAFT_SLUG = /^(copy(-\d+)?-of-|hs-)/i;
const WIX_PLACEHOLDER =
  /I'm a paragraph\. Click here to add your own text|At Wix we['’]re passionate|Wix Pro designers|facebook\.com\/wix|instagram\.com\/wix/i;
const WIX_COUNTER = /\d+\s*\/\s*\d+/;
const IMAGE_REF = /(?:\(|src=["']|heroImage:\s*|-\s+)(\/?images\/[^\s)"']+)/g;

export function isWordPressCollectionUrl(sourceUrl: string | undefined, slug: string): boolean {
  if (!sourceUrl) return false;
  try {
    const pathname = new URL(sourceUrl).pathname.replace(/\/+$/, "") || "/";
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    const leaf = decodeURIComponent(parts[1] ?? "").toLowerCase();
    if (leaf !== slug.toLowerCase()) return false;
    return /^(recipes?|przepisy|categories|category|collections?|topics?)$/i.test(parts[0] ?? "");
  } catch {
    return false;
  }
}

export function platformFamily(platform: string | undefined): PlatformFamily {
  const lower = (platform ?? "").toLowerCase();
  if (lower.includes("wix")) return "wix";
  if (lower.includes("wordpress") || lower.includes("word press")) return "wordpress";
  return "generic";
}

export function stripMediaQuery(url: string): string {
  if (!url) return url;
  if (url.startsWith("/")) {
    const q = url.indexOf("?");
    return q === -1 ? url : url.slice(0, q);
  }
  if (/^https?:\/\//i.test(url)) return wordpressOriginalUrl(url);
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

export function proseLength(body: string): number {
  return body
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

export function markdownLinkCount(body: string): number {
  return contentLinkCount(body);
}

export function contentLinkCount(body: string): number {
  let count = 0;
  const re = /(!)?\[[^\]]*\]\((https?:\/\/[^)]+|\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match[1]) continue;
    const href = match[2] ?? "";
    if (isSocialOrMailHref(href)) continue;
    count += 1;
  }
  return count;
}

export function extractImageRefs(markdown: string, frontmatter: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  if (typeof frontmatter.heroImage === "string") refs.add(stripMediaQuery(frontmatter.heroImage));
  if (Array.isArray(frontmatter.gallery)) {
    for (const item of asGalleryEntries(frontmatter.gallery)) {
      refs.add(stripMediaQuery(galleryItemSrc(item)));
    }
  }
  const re = new RegExp(IMAGE_REF.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (match[1]) refs.add(stripMediaQuery(match[1]));
  }
  return [...refs].filter((ref) => ref.startsWith("/images/") || ref.startsWith("images/"));
}

function localImageCount(markdown: string, frontmatter: Record<string, unknown>): number {
  return extractImageRefs(markdown, frontmatter).length;
}

export function decideEntry(
  input: {
    folder: PackFolder;
    slug: string;
    title: string;
    description: string;
    body: string;
    frontmatter: Record<string, unknown>;
    siblingSlugs: Set<string>;
  },
  family: PlatformFamily,
): PruneDecision {
  const from = `${input.folder}/${input.slug}.md`;
  const bodyAndDesc = `${input.description}\n${input.body}`;
  const cleaned = cleanMarkdownBody(input.body, input.title);
  const links = markdownLinkCount(cleaned);
  const prose = proseLength(cleaned);
  const images = localImageCount(input.body, input.frontmatter);
  const hero =
    typeof input.frontmatter.heroImage === "string"
      ? stripMediaQuery(input.frontmatter.heroImage)
      : "";
  const nonHeroImages = extractImageRefs(input.body, input.frontmatter).filter((ref) => {
    const normalized = ref.startsWith("/") ? ref : `/${ref}`;
    const heroPath = hero.startsWith("/") ? hero : hero ? `/${hero}` : "";
    return normalized !== heroPath;
  }).length;
  const sourceUrl =
    typeof input.frontmatter.sourceUrl === "string" ? input.frontmatter.sourceUrl : undefined;
  const paragraph = firstProseParagraph(cleaned);

  if (PROTECTED.has(input.slug.toLowerCase())) {
    return { slug: input.slug, from, keep: false, reason: "protected-page" };
  }
  if (DRAFT_SLUG.test(input.slug) || /^copy of /i.test(input.title)) {
    return { slug: input.slug, from, keep: false, reason: "draft-slug" };
  }
  if (WIX_PLACEHOLDER.test(bodyAndDesc) || WIX_PLACEHOLDER.test(input.title)) {
    return { slug: input.slug, from, keep: false, reason: "wix-placeholder" };
  }
  const compactDesc = input.description.replace(/[\u200b\s]/g, "");
  if (compactDesc.length < 40 && WIX_COUNTER.test(input.description)) {
    return { slug: input.slug, from, keep: false, reason: "wix-gallery-chrome" };
  }
  if (input.slug.toLowerCase() === "store" && images === 0) {
    return { slug: input.slug, from, keep: false, reason: "empty-store" };
  }

  const baseNew = input.slug.replace(/-new$/i, "");
  if (baseNew !== input.slug && input.siblingSlugs.has(baseNew.toLowerCase())) {
    return { slug: input.slug, from, keep: false, reason: "duplicate-new" };
  }
  const baseTwo = input.slug.replace(/-2$/i, "");
  if (
    family === "wordpress" &&
    baseTwo !== input.slug &&
    input.siblingSlugs.has(baseTwo.toLowerCase())
  ) {
    return { slug: input.slug, from, keep: false, reason: "duplicate-numbered" };
  }

  const wixHub = family === "wix" && links >= 4 && prose < 100;
  const wpHub = family === "wordpress" && ((links >= 8 && prose < 300) || links >= 40);
  const wpCollection =
    family === "wordpress" &&
    isWordPressCollectionUrl(sourceUrl, input.slug) &&
    links >= 2 &&
    (!paragraph || paragraph.length < 80);
  const wpListing =
    family === "wordpress" &&
    links >= 3 &&
    images >= 2 &&
    prose < 180 &&
    (!paragraph || paragraph.length < 80);
  const genericHub = family === "generic" && links >= 4 && prose < 100;
  if (wixHub || wpHub || wpCollection || wpListing || genericHub) {
    return { slug: input.slug, from, keep: false, reason: "hub-index" };
  }

  if (images === 0 && prose < 80) {
    return { slug: input.slug, from, keep: false, reason: "empty" };
  }
  if (nonHeroImages === 0 && !paragraph && proseLength(cleaned) < 80) {
    return { slug: input.slug, from, keep: false, reason: "thin-chrome" };
  }

  let folder: PackFolder = input.folder;
  if (family === "wix" && input.folder !== "blog") {
    folder = "portfolio";
  }

  return { slug: input.slug, from, keep: true, folder, reason: "keep" };
}

function rewriteMedia(markdown: string): string {
  return markdown.replace(/(\/images\/[^\s)"']+)\?[^)\s"']*/g, "$1");
}

function toFrontmatter(
  parsed: Record<string, unknown>,
  folder: PackFolder,
  slug: string,
  body: string,
): { fm: Frontmatter; body: string } {
  const title = polishTitle(String(parsed.title ?? slug));
  const description = polishDescription(
    typeof parsed.description === "string" ? parsed.description : undefined,
    body,
    title,
  );
  const heroImage =
    typeof parsed.heroImage === "string" ? stripMediaQuery(parsed.heroImage) : undefined;
  const parsedGallery = Array.isArray(parsed.gallery)
    ? asGalleryEntries(parsed.gallery).map((item) =>
        typeof item === "string"
          ? stripMediaQuery(item)
          : { ...item, src: stripMediaQuery(item.src) },
      )
    : undefined;
  const gallery = galleryWithoutHero(heroImage, [
    parsedGallery,
    folder === "portfolio" ? localImagePaths(body) : undefined,
  ]);
  const locals = [heroImage, ...gallery.map(galleryItemSrc)].filter((item): item is string =>
    Boolean(item),
  );
  const nextBody = folder === "portfolio" ? stripLocalImageEmbeds(body, locals) : body;

  const fm: Frontmatter = {
    title,
    description,
    slug,
    sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : undefined,
    heroImage,
    gallery: gallery.length ? gallery : undefined,
  };
  if (typeof parsed.heroTitle === "string") fm.heroTitle = parsed.heroTitle;
  if (typeof parsed.heroCaption === "string") fm.heroCaption = parsed.heroCaption;
  if (typeof parsed.heroMediaId === "string") fm.heroMediaId = parsed.heroMediaId;
  if (typeof parsed.heroHash === "string") fm.heroHash = parsed.heroHash;
  if (folder !== "pages") {
    let date = typeof parsed.date === "string" ? parsed.date : "1970-01-01";
    if (date === "1970-01-01") {
      date = yearFromHeadings(body) || (/^\d{4}$/.test(slug) ? `${slug}-01-01` : date);
    }
    fm.date = date;
  }
  const datedBody = folder !== "pages" ? stripYearHeadings(nextBody) : nextBody;
  if (typeof parsed.author === "string") fm.author = parsed.author;
  if (Array.isArray(parsed.categories)) fm.categories = parsed.categories as string[];
  if (Array.isArray(parsed.tags)) fm.tags = parsed.tags as string[];
  return { fm, body: datedBody };
}

export async function prunePack(packDir: string, outputDir: string): Promise<PruneSummary> {
  const source = path.resolve(packDir);
  const output = path.resolve(outputDir);
  await resetDir(output);

  let family: PlatformFamily = "generic";
  const reportPath = path.join(source, "report.json");
  if (await exists(reportPath)) {
    const report = await readJson<{ platform?: string }>(reportPath);
    family = platformFamily(report.platform);
  }

  const reviewPath = path.join(source, "image-review.json");
  const review: ImageReviewEntry[] = (await exists(reviewPath))
    ? ((await readJson<ImageReviewEntry[]>(reviewPath)) ?? [])
    : [];
  const flaggedSkip = new Set(
    review
      .filter((entry) => entry.flags.includes("chrome") || entry.flags.includes("other-host"))
      .map((entry) => entry.sitePath)
      .filter((item): item is string => Boolean(item)),
  );

  type Loaded = {
    folder: PackFolder;
    slug: string;
    file: string;
    raw: string;
    frontmatter: Record<string, unknown>;
    body: string;
  };
  const loaded: Loaded[] = [];
  for (const folder of FOLDERS) {
    const dir = path.join(source, folder);
    if (!(await exists(dir))) continue;
    const files = (await readdir(dir)).filter((name) => name.endsWith(".md"));
    for (const file of files) {
      const raw = await readFile(path.join(dir, file), "utf8");
      const parsed = parseFrontmatter(raw);
      loaded.push({
        folder,
        slug: file.replace(/\.md$/, ""),
        file,
        raw,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
      });
    }
  }

  const siblingSlugs = new Set(loaded.map((item) => item.slug.toLowerCase()));
  const decisions = loaded.map((item) =>
    decideEntry(
      {
        folder: item.folder,
        slug: item.slug,
        title: String(item.frontmatter.title ?? ""),
        description: String(item.frontmatter.description ?? ""),
        body: item.body,
        frontmatter: item.frontmatter,
        siblingSlugs,
      },
      family,
    ),
  );

  const kept: PruneSummary["kept"] = [];
  const dropped: PruneSummary["dropped"] = [];
  let imagesCopied = 0;
  let imagesSkippedFlagged = 0;
  const copiedImages = new Set<string>();
  const keptReview: ImageReviewEntry[] = [];

  for (let i = 0; i < loaded.length; i += 1) {
    const item = loaded[i]!;
    const decision = decisions[i]!;
    if (!decision.keep || !decision.folder) {
      dropped.push({ from: decision.from, reason: decision.reason });
      continue;
    }

    const cleanedBody = cleanMarkdownBody(
      rewriteMedia(item.body),
      stripTitleSuffix(String(item.frontmatter.title ?? item.slug)),
    );
    const { fm, body } = toFrontmatter(item.frontmatter, decision.folder, item.slug, cleanedBody);
    if (typeof fm.heroImage === "string" && flaggedSkip.has(fm.heroImage)) {
      delete fm.heroImage;
      imagesSkippedFlagged += 1;
    }
    if (Array.isArray(fm.gallery)) {
      const next = fm.gallery.filter((item) => {
        if (!flaggedSkip.has(galleryItemSrc(item))) return true;
        imagesSkippedFlagged += 1;
        return false;
      });
      fm.gallery = next.length ? next : undefined;
    }

    const content = serializeMarkdownFile(fm, body);
    const destRel = `${decision.folder}/${item.file}`;
    await writeText(path.join(output, destRel), content);
    kept.push({ from: decision.from, to: destRel });

    const refs = extractImageRefs(content, fm);
    for (const sitePath of refs) {
      const normalized = sitePath.startsWith("/") ? sitePath : `/${sitePath}`;
      if (flaggedSkip.has(normalized)) {
        imagesSkippedFlagged += 1;
        continue;
      }
      if (copiedImages.has(normalized)) continue;
      const fromFile = path.join(source, packFileFromSitePath(normalized));
      if (!(await exists(fromFile))) continue;
      const toFile = path.join(output, packFileFromSitePath(normalized));
      await ensureDir(path.dirname(toFile));
      await copyFile(fromFile, toFile);
      copiedImages.add(normalized);
      imagesCopied += 1;
    }

    for (const entry of review) {
      if (entry.sitePath && refs.includes(entry.sitePath) && !flaggedSkip.has(entry.sitePath)) {
        keptReview.push(entry);
      }
    }
  }

  await writeJson(path.join(output, "image-review.json"), keptReview);
  const manifestPath = path.join(source, "images-manifest.json");
  if (await exists(manifestPath)) {
    const entries = (await readJson<ImageManifestEntry[]>(manifestPath)) ?? [];
    const hasSitePaths = entries.some((entry) => entry.sitePaths?.length);
    const keptManifest = hasSitePaths
      ? entries.filter((entry) => entry.sitePaths?.some((sitePath) => copiedImages.has(sitePath)))
      : entries;
    await writeJson(path.join(output, "images-manifest.json"), keptManifest);
  }
  const summary: PruneSummary = {
    platform: family,
    source,
    output,
    kept,
    dropped,
    imagesCopied,
    imagesSkippedFlagged,
  };
  await writeJson(path.join(output, "prune-report.json"), summary);
  return summary;
}
