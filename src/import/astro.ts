import path from "node:path";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import yaml from "js-yaml";
import { exists } from "../utils/fs.js";
import { parseFrontmatter } from "../markdown/frontmatter.js";
import type { ImageReviewEntry } from "../review/images.js";
import { isSkippedOnImport } from "../review/images.js";
import type { ImportOptions } from "../types/config.js";
import { packFileFromSitePath } from "../pack/paths.js";
import { extractImageRefs } from "../pack/prune.js";
import {
  cleanMarkdownBody,
  galleryWithoutHero,
  polishDescription,
  polishTitle,
  stripYearHeadings,
  yearFromHeadings,
} from "../markdown/cleanup.js";

export type ImportSummary = {
  added: string[];
  skippedProtected: string[];
  skippedExisting: string[];
  filledImages: string[];
  skippedFlaggedImages: number;
  copiedImages: number;
};

const IMPORTABLE = ["pages", "blog", "portfolio"] as const;

function astroKeys(
  frontmatter: Record<string, unknown>,
  collection: string,
): Record<string, unknown> {
  const title = polishTitle(String(frontmatter.title ?? "Untitled"));
  const description = String(frontmatter.description ?? title);
  const next: Record<string, unknown> = {
    title,
    description,
  };
  if (collection !== "pages") {
    next.date = String(frontmatter.date ?? "1970-01-01");
  }
  if (typeof frontmatter.heroImage === "string") next.heroImage = frontmatter.heroImage;
  if (Array.isArray(frontmatter.gallery)) next.gallery = frontmatter.gallery;
  if (Array.isArray(frontmatter.categories)) next.categories = frontmatter.categories;
  if (Array.isArray(frontmatter.tags)) next.tags = frontmatter.tags;
  if (typeof frontmatter.author === "string") next.author = frontmatter.author;
  if (typeof frontmatter.draft === "boolean") next.draft = frontmatter.draft;
  return next;
}

function serializeImported(frontmatter: Record<string, unknown>, body: string): string {
  const yamlBlock = yaml
    .dump(frontmatter, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
      skipInvalid: true,
    })
    .trimEnd();
  const cleanBody = body.replace(/^---[\s\S]*?---\s*/, "").trim();
  return `---\n${yamlBlock}\n---\n\n${cleanBody}\n`;
}

function stripFlaggedImages(markdown: string, skippedSitePaths: Set<string>): string {
  let body = markdown;
  for (const sitePath of skippedSitePaths) {
    const escaped = sitePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n*`, "g"), "");
  }
  return body.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

async function referencedImageMissing(
  targetRoot: string,
  frontmatter: Record<string, unknown>,
): Promise<boolean> {
  const refs = [
    frontmatter.heroImage,
    ...((frontmatter.gallery as string[] | undefined) ?? []),
  ].filter((item): item is string => typeof item === "string" && item.startsWith("/"));
  if (!refs.length) return true;
  for (const ref of refs) {
    const file = path.join(targetRoot, "public", ref.replace(/^\//, ""));
    if (!(await exists(file))) return true;
  }
  return false;
}

export async function importPacks(options: ImportOptions): Promise<ImportSummary> {
  const targetRoot = path.resolve(options.target);
  const configPath = path.join(targetRoot, "src/content/config.ts");
  if (!(await exists(configPath))) {
    throw new Error(
      `Target is not an Astro content tree (missing src/content/config.ts): ${targetRoot}`,
    );
  }

  const summary: ImportSummary = {
    added: [],
    skippedProtected: [],
    skippedExisting: [],
    filledImages: [],
    skippedFlaggedImages: 0,
    copiedImages: 0,
  };

  const protectedSet = new Set(options.protectedPages.map((item) => item.toLowerCase()));

  for (const packDir of options.packs) {
    const packRoot = path.resolve(packDir);
    const reviewPath = path.join(packRoot, "image-review.json");
    let review: ImageReviewEntry[] = [];
    if (await exists(reviewPath)) {
      review = JSON.parse(await readFile(reviewPath, "utf8")) as ImageReviewEntry[];
    }

    const skippedSitePaths = new Set<string>();
    for (const entry of review) {
      if (
        isSkippedOnImport(entry.flags, {
          includeFlagged: options.includeFlagged,
          flagInlineBlog: options.flagInlineBlog,
        })
      ) {
        if (entry.sitePath) skippedSitePaths.add(entry.sitePath);
        summary.skippedFlaggedImages += 1;
      }
    }

    for (const collection of IMPORTABLE) {
      const fromDir = path.join(packRoot, collection);
      if (!(await exists(fromDir))) continue;
      const { readdir } = await import("node:fs/promises");
      const files = (await readdir(fromDir)).filter((name) => name.endsWith(".md"));
      for (const file of files) {
        const slug = file.replace(/\.md$/, "");
        const destDir = path.join(targetRoot, "src/content", collection, options.locale);
        const destFile = path.join(destDir, file);
        const sourceFile = path.join(fromDir, file);
        const raw = await readFile(sourceFile, "utf8");
        const parsed = parseFrontmatter(raw);
        const fm = astroKeys(parsed.frontmatter, collection);
        const packHero = typeof fm.heroImage === "string" ? fm.heroImage : undefined;
        const packBodyRefs = extractImageRefs(parsed.body, parsed.frontmatter).map((ref) =>
          ref.startsWith("/") ? ref : `/${ref}`,
        );
        fm.gallery = galleryWithoutHero(packHero, [
          Array.isArray(fm.gallery) ? (fm.gallery as string[]) : undefined,
          packBodyRefs,
        ]);

        if (protectedSet.has(slug.toLowerCase())) {
          const allow =
            collection === "pages" ? options.overwritePages : options.overwriteEntries;
          if (!allow) {
            summary.skippedProtected.push(`${collection}/${slug}`);
            continue;
          }
        }

        const destExists = await exists(destFile);
        if (destExists && collection !== "pages" && !options.overwriteEntries) {
          const missing = await referencedImageMissing(targetRoot, parsed.frontmatter);
          if (!missing) {
            summary.skippedExisting.push(`${collection}/${slug}`);
            continue;
          }
          await copyEntryImages(
            packRoot,
            targetRoot,
            parsed.frontmatter,
            parsed.body,
            skippedSitePaths,
            summary,
          );
          const existingRaw = await readFile(destFile, "utf8");
          const existing = parseFrontmatter(existingRaw);
          const existingHero =
            (typeof existing.frontmatter.heroImage === "string" && existing.frontmatter.heroImage) ||
            packHero;
          const merged: Record<string, unknown> = {
            ...existing.frontmatter,
            heroImage: packHero ?? existing.frontmatter.heroImage,
            gallery: galleryWithoutHero(existingHero, [
              Array.isArray(existing.frontmatter.gallery)
                ? (existing.frontmatter.gallery as string[])
                : undefined,
              Array.isArray(fm.gallery) ? (fm.gallery as string[]) : undefined,
            ]),
          };
          delete merged.slug;
          delete merged.sourceUrl;
          await mkdir(destDir, { recursive: true });
          await writeFile(destFile, serializeImported(merged, existing.body), "utf8");
          summary.filledImages.push(`${collection}/${slug}`);
          continue;
        }

        if (destExists && collection === "pages" && !options.overwritePages) {
          summary.skippedProtected.push(`${collection}/${slug}`);
          continue;
        }

        await copyEntryImages(
          packRoot,
          targetRoot,
          parsed.frontmatter,
          parsed.body,
          skippedSitePaths,
          summary,
        );

        if (typeof fm.heroImage === "string" && skippedSitePaths.has(fm.heroImage)) {
          delete fm.heroImage;
        }
        if (Array.isArray(fm.gallery)) {
          fm.gallery = fm.gallery.filter(
            (item) => typeof item === "string" && !skippedSitePaths.has(item),
          );
        }

        let body = cleanMarkdownBody(
          stripFlaggedImages(parsed.body, skippedSitePaths),
          String(fm.title),
        );
        fm.description = polishDescription(
          typeof parsed.frontmatter.description === "string"
            ? parsed.frontmatter.description
            : String(fm.description),
          body,
          String(fm.title),
        );
        if (collection !== "pages" && fm.date === "1970-01-01") {
          const fromHeading = yearFromHeadings(parsed.body) || yearFromHeadings(body);
          if (fromHeading) fm.date = fromHeading;
        }
        if (collection !== "pages") body = stripYearHeadings(body);
        await mkdir(destDir, { recursive: true });
        await writeFile(destFile, serializeImported(fm, body), "utf8");
        summary.added.push(`${collection}/${slug}`);
      }
    }
  }

  return summary;
}

async function copyEntryImages(
  packRoot: string,
  targetRoot: string,
  frontmatter: Record<string, unknown>,
  body: string,
  skippedSitePaths: Set<string>,
  summary: ImportSummary,
): Promise<void> {
  const refs = extractImageRefs(body, frontmatter).map((ref) =>
    ref.startsWith("/") ? ref : `/${ref}`,
  );

  for (const sitePath of refs) {
    if (skippedSitePaths.has(sitePath)) continue;
    const from = path.join(packRoot, packFileFromSitePath(sitePath));
    const to = path.join(targetRoot, "public", packFileFromSitePath(sitePath));
    if (!(await exists(from))) continue;
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
    summary.copiedImages += 1;
  }
}
