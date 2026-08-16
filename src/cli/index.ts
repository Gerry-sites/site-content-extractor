#!/usr/bin/env node
import { Command } from "commander";
import { CliOptionsSchema, ImportOptionsSchema } from "../types/config.js";
import { runMigration } from "../pipeline/migrate.js";
import { importPacks } from "../import/astro.js";

const program = new Command();

program
  .name("site-migrate")
  .description(
    "Migrate publicly accessible websites into clean Markdown and structured assets for Astro",
  )
  .version("0.1.0");

function parsePathList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

program
  .command("migrate", { isDefault: true })
  .description("Crawl a site and write a Markdown + image pack")
  .argument("<url>", "Seed URL of the website to migrate")
  .option("-o, --output <dir>", "Output directory", "output")
  .option("-d, --depth <n>", "Maximum crawl depth", (v) => Number(v), 10)
  .option("--images", "Download images (default: true)", true)
  .option("--no-images", "Do not download images")
  .option("--markdown", "Generate Markdown (default: true)", true)
  .option("--no-markdown", "Skip Markdown generation")
  .option("-v, --verbose", "Verbose logging", false)
  .option("--headless", "Run browser headless (default: true)", true)
  .option("--no-headless", "Show the browser window")
  .option("--resume", "Recrawl only URLs that still have no cached HTML", false)
  .option("--overwrite", "Overwrite existing output directory", false)
  .option("--skip-images", "Skip image downloading", false)
  .option("--skip-blog", "Do not treat pages as blog posts", false)
  .option(
    "--platform <name>",
    "Platform extractor: auto|generic|wix|webflow|squarespace|wordpress|...",
    "auto",
  )
  .option("--no-respect-robots", "Ignore robots.txt")
  .option("--concurrency <n>", "Parallel crawl/download concurrency", (v) => Number(v), 2)
  .option("--timeout <ms>", "Navigation timeout in milliseconds", (v) => Number(v), 90_000)
  .option("--settle-ms <ms>", "Wait after networkidle for JS galleries", (v) => Number(v), 2_500)
  .option("--paths <list>", "Extra seed paths (comma-separated)", "/about,/contact")
  .option("--responsive-images", "Generate responsive image variants", false)
  .option("--json-export", "Also write content.json", false)
  .action(async (url: string, opts: Record<string, unknown>) => {
    const parsed = CliOptionsSchema.safeParse({
      url,
      output: opts.output,
      depth: opts.depth,
      images: opts.images,
      markdown: opts.markdown,
      verbose: opts.verbose,
      headless: opts.headless,
      resume: opts.resume,
      overwrite: opts.overwrite,
      skipImages: opts.skipImages,
      skipBlog: opts.skipBlog,
      platform: opts.platform,
      respectRobots: opts.respectRobots,
      concurrency: opts.concurrency,
      timeoutMs: opts.timeout,
      settleMs: opts.settleMs,
      paths: parsePathList(opts.paths as string | undefined, ["/about", "/contact"]),
      generateResponsive: opts.responsiveImages,
      jsonExport: opts.jsonExport,
    });

    if (!parsed.success) {
      console.error("Invalid options:");
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    try {
      const result = await runMigration(parsed.data);
      if (!result.validationOk) {
        console.warn("Validation reported errors — see report.md and warnings above.");
        process.exitCode = 2;
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("import")
  .description("Copy a pack into an Astro starter clone")
  .argument("<packs...>", "Pack output directories")
  .requiredOption("--target <dir>", "Astro site root (must contain src/content/config.ts)")
  .option("--locale <code>", "Content locale folder", "en")
  .option("--protected-pages <list>", "Page slugs that are not overwritten", "home,about,contact")
  .option("--overwrite-pages", "Replace protected page Markdown", false)
  .option("--overwrite-entries", "Replace existing portfolio/blog Markdown", false)
  .option("--include-flagged", "Copy images that image-review flagged", false)
  .option("--no-flag-inline-blog", "Do not skip inline blog images on import")
  .action(async (packs: string[], opts: Record<string, unknown>) => {
    const parsed = ImportOptionsSchema.safeParse({
      packs,
      target: opts.target,
      locale: opts.locale,
      protectedPages: parsePathList(opts.protectedPages as string | undefined, [
        "home",
        "about",
        "contact",
      ]),
      overwritePages: opts.overwritePages,
      overwriteEntries: opts.overwriteEntries,
      includeFlagged: opts.includeFlagged,
      flagInlineBlog: opts.flagInlineBlog,
    });

    if (!parsed.success) {
      console.error("Invalid import options:");
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    try {
      const summary = await importPacks(parsed.data);
      console.log("Import summary");
      console.log(`  Added:            ${summary.added.length}`);
      console.log(`  Protected skipped:${summary.skippedProtected.length}`);
      console.log(`  Existing skipped: ${summary.skippedExisting.length}`);
      console.log(`  Filled images:    ${summary.filledImages.length}`);
      console.log(`  Images copied:    ${summary.copiedImages}`);
      console.log(`  Flagged skipped:  ${summary.skippedFlaggedImages}`);
      for (const item of summary.added) console.log(`    + ${item}`);
      for (const item of summary.skippedProtected) console.log(`    ~ ${item}`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
