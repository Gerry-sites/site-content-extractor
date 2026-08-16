import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { parseFrontmatter } from "../markdown/frontmatter.js";
import { packFileFromSitePath } from "../pack/paths.js";
import { asGalleryEntries, galleryItemSrc, type GalleryEntry } from "../pack/gallery.js";
import { isSkippedOnImport, type ImageReviewEntry } from "../review/images.js";
import type { VerifyGalleryOptions } from "../types/config.js";
import { exists, fileSha256 } from "../utils/fs.js";

export type VerifyGalleryIssue = {
  file: string;
  level: "error";
  message: string;
};

export type VerifyGalleryResult = {
  ok: boolean;
  issues: VerifyGalleryIssue[];
};

type Work = {
  file: string;
  src: string;
  title?: string;
  caption?: string;
  mediaId?: string;
  yamlHash?: string;
  fileHash?: string;
};

const COLLECTIONS = ["pages", "blog", "portfolio"] as const;

function issue(file: string, message: string): VerifyGalleryIssue {
  return { file, level: "error", message };
}

function workFromHero(file: string, fm: Record<string, unknown>): Work | undefined {
  if (typeof fm.heroImage !== "string" || !fm.heroImage.startsWith("/images/")) return undefined;
  return {
    file,
    src: fm.heroImage,
    title: typeof fm.heroTitle === "string" ? fm.heroTitle : undefined,
    caption: typeof fm.heroCaption === "string" ? fm.heroCaption : undefined,
    mediaId: typeof fm.heroMediaId === "string" ? fm.heroMediaId : undefined,
    yamlHash: typeof fm.heroHash === "string" ? fm.heroHash : undefined,
  };
}

function workFromGalleryItem(file: string, item: GalleryEntry): Work | undefined {
  const src = galleryItemSrc(item);
  if (!src.startsWith("/images/")) return undefined;
  if (typeof item === "string") return { file, src };
  return {
    file,
    src,
    title: item.title,
    caption: item.caption,
    mediaId: item.mediaId,
    yamlHash: item.hash,
  };
}

function worksFromFrontmatter(file: string, fm: Record<string, unknown>): Work[] {
  const works: Work[] = [];
  const hero = workFromHero(file, fm);
  if (hero) works.push(hero);
  for (const item of asGalleryEntries(fm.gallery)) {
    const work = workFromGalleryItem(file, item);
    if (work) works.push(work);
  }
  return works;
}

async function loadMarkdownWorks(
  root: string,
  collections: readonly string[],
  locale?: string,
): Promise<Work[]> {
  const works: Work[] = [];
  for (const collection of collections) {
    const dir = locale
      ? path.join(root, "src/content", collection, locale)
      : path.join(root, collection);
    if (!(await exists(dir))) continue;
    const files = (await readdir(dir)).filter((name) => name.endsWith(".md"));
    for (const name of files) {
      const rel = locale ? `src/content/${collection}/${locale}/${name}` : `${collection}/${name}`;
      const raw = await readFile(path.join(dir, name), "utf8");
      works.push(...worksFromFrontmatter(rel, parseFrontmatter(raw).frontmatter));
    }
  }
  return works;
}

async function hashWorkFile(
  root: string,
  src: string,
  publicPrefix: boolean,
): Promise<string | undefined> {
  const relative = packFileFromSitePath(src);
  const file = publicPrefix ? path.join(root, "public", relative) : path.join(root, relative);
  return fileSha256(file);
}

function captionText(work: Work): string {
  return [work.title, work.caption].filter(Boolean).join("\n");
}

async function skippedSitePaths(packRoot: string): Promise<Set<string>> {
  const reviewPath = path.join(packRoot, "image-review.json");
  if (!(await exists(reviewPath))) return new Set();
  const review = JSON.parse(await readFile(reviewPath, "utf8")) as ImageReviewEntry[];
  const skipped = new Set<string>();
  for (const entry of review) {
    if (isSkippedOnImport(entry.flags, { includeFlagged: false, flagInlineBlog: false })) {
      if (entry.sitePath) skipped.add(entry.sitePath);
    }
  }
  return skipped;
}

/**
 * Fail when a gallery caption is attached to the wrong file.
 * Compares YAML identity (mediaId/hash) to bytes on disk, and optionally pack vs clone.
 */
export async function verifyGallery(options: VerifyGalleryOptions): Promise<VerifyGalleryResult> {
  const packRoot = path.resolve(options.pack);
  const issues: VerifyGalleryIssue[] = [];
  const skipped = await skippedSitePaths(packRoot);
  const packWorks = (await loadMarkdownWorks(packRoot, COLLECTIONS)).filter(
    (work) => !skipped.has(work.src),
  );

  for (const work of packWorks) {
    work.fileHash = await hashWorkFile(packRoot, work.src, false);
    if (!work.fileHash) {
      issues.push(issue(work.file, `Missing image file for ${work.src}`));
      continue;
    }
    if (work.yamlHash && work.yamlHash !== work.fileHash) {
      issues.push(
        issue(
          work.file,
          `YAML hash for ${work.src} does not match the file on disk (caption is bound to a different work)`,
        ),
      );
    }
  }

  const byMediaId = new Map<string, Work>();
  for (const work of packWorks) {
    if (!work.mediaId) continue;
    const prev = byMediaId.get(work.mediaId);
    if (!prev) {
      byMediaId.set(work.mediaId, work);
      continue;
    }
    if (prev.fileHash && work.fileHash && prev.fileHash !== work.fileHash) {
      issues.push(
        issue(
          work.file,
          `mediaId ${work.mediaId} maps to different files (${prev.src} vs ${work.src})`,
        ),
      );
    }
    if (captionText(prev) && captionText(work) && captionText(prev) !== captionText(work)) {
      issues.push(
        issue(
          work.file,
          `mediaId ${work.mediaId} has different captions on ${prev.src} and ${work.src}`,
        ),
      );
    }
  }

  if (options.target) {
    const targetRoot = path.resolve(options.target);
    const locale = options.locale || "en";
    const cloneWorks = await loadMarkdownWorks(targetRoot, COLLECTIONS, locale);
    const cloneBySrc = new Map(cloneWorks.map((work) => [work.src, work]));
    const cloneByMediaId = new Map(
      cloneWorks.filter((work) => work.mediaId).map((work) => [work.mediaId!, work]),
    );

    for (const packWork of packWorks) {
      if (!packWork.fileHash) continue;
      const cloneFileHash = await hashWorkFile(targetRoot, packWork.src, true);
      if (!cloneFileHash) {
        issues.push(
          issue(
            packWork.file,
            `Clone is missing ${packWork.src} (pack file hash ${packWork.fileHash.slice(0, 12)})`,
          ),
        );
        continue;
      }
      if (cloneFileHash !== packWork.fileHash) {
        issues.push(
          issue(
            packWork.file,
            `Clone file at ${packWork.src} is a different work than the pack (hash mismatch)`,
          ),
        );
      }

      const cloneWork =
        (packWork.mediaId ? cloneByMediaId.get(packWork.mediaId) : undefined) ||
        cloneBySrc.get(packWork.src);
      if (!cloneWork) continue;
      const packCaption = captionText(packWork);
      const cloneCaption = captionText(cloneWork);
      if (packCaption && cloneCaption && packCaption !== cloneCaption) {
        issues.push(
          issue(
            packWork.file,
            `Clone caption for ${packWork.src} does not match the pack (${cloneCaption} vs ${packCaption})`,
          ),
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
