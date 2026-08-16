import path from "node:path";
import type { CliOptions } from "../types/config.js";
import type {
  ExtractedPage,
  MigrationReport,
  NavigationItem,
  SiteMetadata,
} from "../types/schemas.js";
import { crawlSite } from "../crawler/index.js";
import { detectPlatform } from "../detect/platform.js";
import { getExtractor } from "../extractors/registry.js";
import { downloadImages } from "../download/images.js";
import { generateMarkdown } from "../markdown/generate.js";
import { writeReport } from "../reports/generate.js";
import { validateOutput } from "../validate/markdown.js";
import { ensureDir, exists, resetDir, writeJson, writeText } from "../utils/fs.js";
import { createLogger } from "../utils/log.js";
import { uniqueSlug } from "../utils/slug.js";
import { assignSiteImagePaths } from "../pack/assign.js";
import { reviewExtractedPages } from "../review/images.js";
import { buildCoverage, coverageHasHoles } from "../pack/coverage.js";
import { removeOrphanMarkdown } from "../pack/orphans.js";
import { prunePack } from "../pack/prune.js";
import { upgradeMediaUrl } from "../media/urls.js";

export type MigrationResult = {
  report: MigrationReport;
  outputDir: string;
  platform: string;
  validationOk: boolean;
};

export async function runMigration(options: CliOptions): Promise<MigrationResult> {
  const logger = createLogger(options.verbose);
  const startedAt = new Date().toISOString();
  const outputDir = path.resolve(options.output);

  if ((await exists(outputDir)) && !options.resume && !options.overwrite) {
    throw new Error(`Output directory "${outputDir}" already exists. Use --overwrite or --resume.`);
  }

  if (options.overwrite && !options.resume) {
    await resetDir(outputDir);
  } else {
    await ensureDir(outputDir);
    await ensureDir(path.join(outputDir, "pages"));
    await ensureDir(path.join(outputDir, "blog"));
    await ensureDir(path.join(outputDir, "portfolio"));
    await ensureDir(path.join(outputDir, "images"));
  }

  logger.info(`Migrating ${options.url}`);
  logger.info(`Output: ${outputDir}`);

  // 1. Crawl
  const { manifest, htmlByUrl, seedMissing } = await crawlSite(
    {
      url: options.url,
      output: outputDir,
      depth: options.depth,
      headless: options.headless,
      resume: options.resume,
      respectRobots: options.respectRobots,
      concurrency: options.concurrency,
      timeoutMs: options.timeoutMs,
      userAgent: options.userAgent,
      verbose: options.verbose,
      settleMs: options.settleMs,
      paths: options.paths,
    },
    logger,
  );

  // 2. Detect platform using homepage HTML
  const seedHtml = htmlByUrl.get(manifest.seedUrl) || htmlByUrl.values().next().value || "";

  let platformId = options.platform === "auto" ? "generic" : options.platform;

  if (options.platform === "auto") {
    const detection = await detectPlatform({
      url: manifest.seedUrl,
      html: seedHtml,
      seedUrl: manifest.seedUrl,
    });
    platformId = detection.platform;
    logger.info(`Detected: ${detection.name} (confidence ${detection.confidence.toFixed(2)})`);
  } else {
    logger.info(`Platform: ${platformId}`);
  }

  const extractor = getExtractor(platformId);

  // 3. Extract pages
  const usedSlugs = new Set<string>();
  const extractedPages: ExtractedPage[] = [];
  let navigation: NavigationItem[] = [];
  let metadata: SiteMetadata = { socialLinks: [] };
  const warnings: string[] = [];
  const brokenLinks: string[] = [];

  for (const page of manifest.pages) {
    const html = htmlByUrl.get(page.normalizedUrl);
    if (!html) {
      const extraSeed404 =
        page.source === "seed" &&
        page.normalizedUrl !== manifest.seedUrl &&
        page.status !== undefined &&
        page.status >= 400;
      if (!extraSeed404) {
        warnings.push(`No HTML captured for ${page.normalizedUrl}`);
      }
      if (page.status && page.status >= 400) {
        brokenLinks.push(page.normalizedUrl);
      }
      continue;
    }

    const ctx = {
      url: page.normalizedUrl,
      html,
      seedUrl: manifest.seedUrl,
    };

    try {
      const extracted = await extractor.extractPage(ctx);
      extracted.slug = uniqueSlug(extracted.slug || "page", usedSlugs);

      if (options.skipBlog) {
        extracted.isBlogPost = false;
        extracted.kind = extracted.kind === "blog" ? "page" : extracted.kind;
      }

      extractedPages.push(extracted);

      if (!navigation.length && extractor.extractNavigation) {
        navigation = await extractor.extractNavigation(ctx);
      }
      if (!metadata.siteTitle && extractor.extractMetadata) {
        metadata = await extractor.extractMetadata(ctx);
      }
    } catch (err) {
      warnings.push(
        `Extraction failed for ${page.normalizedUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 4. Download images
  const allImageUrls = new Set<string>();
  for (const page of extractedPages) {
    for (const img of page.images) allImageUrls.add(img.src);
    if (page.heroImage) allImageUrls.add(page.heroImage);
    for (const gallery of page.galleries) {
      for (const src of gallery.images) allImageUrls.add(src);
    }
  }
  if (metadata.favicon) allImageUrls.add(metadata.favicon);
  if (metadata.logo) allImageUrls.add(metadata.logo);
  if (metadata.openGraph?.image) allImageUrls.add(metadata.openGraph.image);

  let brokenImages: string[] = [];
  const imagePathMap = new Map<string, string>();
  const imagePathsByPage = new Map<string, Map<string, string>>();

  if (!options.skipImages && options.images) {
    const downloadResult = await downloadImages(
      [...allImageUrls],
      outputDir,
      {
        concurrency: options.concurrency,
        userAgent: options.userAgent,
        resume: options.resume,
        generateResponsive: options.generateResponsive,
        referer: `${new URL(manifest.seedUrl).origin}/`,
      },
      logger,
    );
    brokenImages = downloadResult.broken;

    // Rewrite metadata asset paths to local pack files
    if (metadata.favicon && downloadResult.byRemoteUrl.has(metadata.favicon)) {
      metadata.favicon = downloadResult.byRemoteUrl.get(metadata.favicon)!.relativePath;
    }
    if (metadata.logo && downloadResult.byRemoteUrl.has(metadata.logo)) {
      metadata.logo = downloadResult.byRemoteUrl.get(metadata.logo)!.relativePath;
    }
    if (metadata.openGraph?.image && downloadResult.byRemoteUrl.has(metadata.openGraph.image)) {
      metadata.openGraph.image = downloadResult.byRemoteUrl.get(
        metadata.openGraph.image,
      )!.relativePath;
    }

    logger.info(
      `Images: ${downloadResult.images.length} downloaded, ${brokenImages.length} broken`,
    );

    const organized = await assignSiteImagePaths(
      extractedPages,
      downloadResult.byRemoteUrl,
      outputDir,
      options.skipBlog,
    );
    for (const [remote, sitePath] of organized.byRemoteUrl) {
      imagePathMap.set(remote, sitePath);
      imagePathMap.set(upgradeMediaUrl(remote), sitePath);
    }
    for (const [pageUrl, pageMap] of organized.byPageUrl) {
      imagePathsByPage.set(pageUrl, pageMap);
    }
  }

  const review = reviewExtractedPages(
    extractedPages,
    manifest.seedUrl,
    imagePathMap,
    imagePathsByPage,
  );
  await writeJson(path.join(outputDir, "image-review.json"), review);

  // 5. Generate markdown
  const writtenByUrl = new Map<string, string>();
  const markdownContents: string[] = [];
  if (options.markdown) {
    const keep = new Set<string>();
    for (const page of extractedPages) {
      const md = generateMarkdown(page, imagePathsByPage.get(page.url) ?? imagePathMap, {
        skipBlog: options.skipBlog,
      });
      const outPath = path.join(outputDir, md.relativePath);
      await writeText(outPath, md.content);
      writtenByUrl.set(page.url, md.relativePath);
      keep.add(md.relativePath.replace(/\\/g, "/"));
      markdownContents.push(md.content);
      logger.debug(`Wrote ${md.relativePath}`);
    }
    const removed = await removeOrphanMarkdown(outputDir, keep);
    for (const rel of removed) {
      logger.info(`Removed orphan Markdown ${rel}`);
    }
  }

  // 6. Structured assets
  await writeJson(path.join(outputDir, "navigation.json"), navigation);
  await writeJson(path.join(outputDir, "metadata.json"), metadata);
  await writeJson(path.join(outputDir, "sitemap.json"), {
    seedUrl: manifest.seedUrl,
    generatedAt: new Date().toISOString(),
    urls: manifest.pages.map((p) => ({
      url: p.normalizedUrl,
      title: p.title,
      status: p.status,
    })),
  });

  if (options.jsonExport) {
    await writeJson(path.join(outputDir, "content.json"), extractedPages);
  }

  // Optional Astro content collection stub
  await writeText(
    path.join(outputDir, "astro-content.config.example.ts"),
    `import { defineCollection, z } from "astro:content";

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    heroImage: z.string().optional(),
    gallery: z.array(z.string()).optional(),
  }),
});

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    slug: z.string(),
    date: z.string().optional(),
    author: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),
  }),
});

export const collections = { pages, blog };
`,
  );

  const coverage = buildCoverage({
    pages: manifest.pages,
    htmlByUrl,
    extracted: extractedPages,
    writtenByUrl,
    imagePathMap,
    brokenImages,
    markdownContents,
    seedMissing,
    skipImages: options.skipImages || !options.images,
  });

  // 7. Validate
  const validation = await validateOutput(outputDir);
  for (const issue of validation.issues) {
    warnings.push(`[${issue.level}] ${issue.file}: ${issue.message}`);
  }
  if (coverage.missingHtml.length) {
    warnings.push(`[error] Coverage: missing HTML for ${coverage.missingHtml.length} URL(s)`);
  }
  if (coverage.missingMarkdown.length) {
    warnings.push(
      `[error] Coverage: missing Markdown for ${coverage.missingMarkdown.length} page(s)`,
    );
  }
  if (coverage.missingImages.length) {
    warnings.push(
      `[error] Coverage: missing ${coverage.missingImages.length} content image download(s)`,
    );
  }
  if (coverage.leftoverRemote.length) {
    warnings.push(
      `[error] Coverage: ${coverage.leftoverRemote.length} remote content image(s) remain in Markdown`,
    );
  }
  for (const seed of coverage.seedMissing) {
    warnings.push(`Extra seed ${seed.path} returned HTTP ${seed.status ?? "?"}`);
  }

  const missingMetadata: string[] = [];
  if (!metadata.siteTitle) missingMetadata.push("siteTitle");
  if (!metadata.description) missingMetadata.push("description");
  if (!metadata.favicon) missingMetadata.push("favicon");
  if (!navigation.length) missingMetadata.push("navigation");

  const recommendations: string[] = [];
  if (brokenImages.length) {
    recommendations.push("Review broken images and replace or remove references.");
  }
  if (!navigation.length) {
    recommendations.push(
      "Navigation could not be detected automatically — edit navigation.json manually.",
    );
  }
  if (platformId === "generic") {
    recommendations.push(
      "Platform detected as generic. Consider adding a dedicated extractor plugin for cleaner results.",
    );
  }
  const flagged = review.filter((entry) => entry.flags.length > 0);
  recommendations.push(
    "Import with `site-migrate import <pack> --target <astro-clone>` after reviewing image-review.json.",
  );
  if (flagged.length) {
    recommendations.push(
      `${flagged.length} images were flagged (chrome, other-host, title-name-in-media, or inline-blog). Import skips them unless --include-flagged.`,
    );
  }

  const blogPosts = extractedPages.filter((p) => p.isBlogPost).length;
  const galleries = extractedPages.reduce((sum, p) => sum + p.galleries.length, 0);

  const finishedAt = new Date().toISOString();
  const report: MigrationReport = {
    seedUrl: options.url,
    platform: extractor.name,
    startedAt,
    finishedAt,
    pages: extractedPages.length,
    blogPosts,
    images: imagePathMap.size,
    galleries,
    brokenImages,
    brokenLinks,
    missingMetadata,
    warnings,
    recommendations,
    coverage,
  };

  await writeJson(path.join(outputDir, "report.json"), report);
  await writeReport(outputDir, report);

  if (!options.skipPrune) {
    const prunedDir = path.join(outputDir, "pruned");
    const pruned = await prunePack(outputDir, prunedDir);
    logger.info(
      `Pruned ${pruned.kept.length} keepers (${pruned.dropped.length} dropped) → ${prunedDir}`,
    );
  }

  logger.info("");
  logger.info("Migration Summary");
  logger.info(`  Pages:        ${report.pages}`);
  logger.info(`  Blog Posts:   ${report.blogPosts}`);
  logger.info(`  Images:       ${report.images}`);
  logger.info(`  Broken Images:${report.brokenImages.length}`);
  logger.info(`  Warnings:     ${report.warnings.length}`);
  logger.info(`  Coverage:     ${coverage.withHtml}/${coverage.discovered} HTML`);
  logger.info(`  Output:       ${outputDir}`);

  return {
    report,
    outputDir,
    platform: extractor.name,
    validationOk: validation.ok && !coverageHasHoles(coverage),
  };
}
