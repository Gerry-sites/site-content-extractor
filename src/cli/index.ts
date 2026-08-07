#!/usr/bin/env node
import { Command } from "commander";
import { CliOptionsSchema } from "../types/config.js";
import { runMigration } from "../pipeline/migrate.js";

const program = new Command();

program
  .name("site-migrate")
  .description(
    "Migrate publicly accessible websites into clean Markdown and structured assets for Astro",
  )
  .version("0.1.0")
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
  .option("--resume", "Resume from existing output/pages.json", false)
  .option("--overwrite", "Overwrite existing output directory", false)
  .option("--skip-images", "Skip image downloading", false)
  .option("--skip-blog", "Do not treat pages as blog posts", false)
  .option(
    "--platform <name>",
    "Platform extractor: auto|generic|wix|webflow|squarespace|...",
    "auto",
  )
  .option("--no-respect-robots", "Ignore robots.txt")
  .option(
    "--concurrency <n>",
    "Parallel crawl/download concurrency",
    (v) => Number(v),
    3,
  )
  .option(
    "--timeout <ms>",
    "Navigation timeout in milliseconds",
    (v) => Number(v),
    30_000,
  )
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
        console.warn(
          "Validation reported errors — see report.md and warnings above.",
        );
        process.exitCode = 2;
      }
    } catch (err) {
      console.error(
        err instanceof Error ? err.message : String(err),
      );
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
