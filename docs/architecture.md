# Architecture

`site-migrate` is organized around a small core pipeline and swappable **platform extractors**.

```text
src/
  cli/           Commander entrypoint
  crawler/       Playwright crawl, robots.txt, sitemap
  detect/        Platform auto-detection
  extractors/    Platform plugins (generic, wix, …)
  transformers/  Optional post-extraction hooks (`applyTransformers`)
  download/      Image downloading + resume manifest
  markdown/      Turndown + frontmatter serialization
  images/        Sharp thumbnails / responsive variants
  reports/       Migration report writer
  validate/      Output validation
  pipeline/      End-to-end orchestration
  types/         Zod schemas + CLI config
  utils/         URL, slug, hash, fs helpers
```

## Pipeline

1. **Crawl** — Playwright discovers internal URLs from the seed page, navigation links, and `sitemap.xml`. Results are written to `pages.json`.
2. **Detect** — HTML/URL signals choose a platform extractor (`--platform=auto`).
3. **Extract** — The selected extractor returns structured page content (title, HTML body, images, galleries, blog meta).
4. **Download** — Referenced images are fetched, hash-deduplicated, and thumbnailed.
5. **Markdown** — HTML is converted to human-editable Markdown with YAML frontmatter.
6. **Assets** — `navigation.json`, `metadata.json`, `sitemap.json` are written.
7. **Report + validate** — `report.md` summarizes the run; validators check titles, slugs, and image refs.

## Plugin boundary

Core modules never hard-code Wix/Squarespace DOM details. Platform-specific logic lives in:

```text
src/extractors/<platform>/index.ts
```

Each extractor implements:

```ts
type PlatformExtractor = {
  id: PlatformId;
  name: string;
  detect(ctx): number;          // 0–1 confidence
  extractPage(ctx): ExtractedPage;
  extractNavigation?(ctx);
  extractMetadata?(ctx);
};
```

See [Writing platform plugins](plugins.md).

## Determinism

- URLs are normalized (strip hash/tracking params, sort query keys)
- Slugs are uniqued deterministically
- Duplicate images collapse to one file via SHA-256
- Manifests are stable JSON with sorted page lists

## Crawl4AI note

[Crawl4AI](https://github.com/unclecode/crawl4ai) is a Python-first crawler. This project stays on Node 22 + Playwright + Cheerio for a single-runtime CLI. A future optional bridge can call Crawl4AI for difficult JS-heavy sites without changing the extractor interface.
