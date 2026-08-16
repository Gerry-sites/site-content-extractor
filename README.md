# site-migrate

Migrate publicly accessible websites into clean Markdown and structured assets suitable for [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

The CLI is **`site-migrate <url>`** for any public origin. Per-site differences go through flags (`--platform`, `--paths`, `--settle-ms`, `--locale`). Nothing in `src/` is hardcoded to a client hostname.

The tool prioritizes **content extraction** over layout reproduction. Plugins cover Wix, WordPress, Squarespace, Webflow, and plain HTML.

## Features

- Playwright-based crawling with sitemap + navigation + REST/feed discovery
- JS gallery hydration (`img.currentSrc`, Load more clicks, `--settle-ms`)
- robots.txt respect (override available)
- Platform auto-detection (`wix`, `wordpress`, `webflow`, `squarespace`, `generic`)
- Clean HTML → Markdown with YAML frontmatter (`title`, `description`, `date`, `heroImage`, `gallery`)
- Image download with Wix/WordPress URL upgrades, hash deduplication, thumbnails
- Gallery identity (`mediaId` + SHA-256) so captions stay on the matching file across re-extract/import
- `site-migrate verify-gallery` fails when a title is bound to the wrong bytes
- `image-review.json` flags chrome / other-host / title-name illustrations
- `site-migrate import` copies a pack into an Astro starter clone
- `navigation.json`, `metadata.json`, `sitemap.json`, `report.md`
- Output validation (titles, descriptions, dates, image refs)

## Requirements

- Node.js **22+**
- npm 10+

## Install

```bash
npm install
npx playwright install chromium
npm run build
```

For local development without building:

```bash
npm run dev -- https://example.com --output ./output
```

## Quick start

After install + build:

```bash
node dist/cli/index.js https://example.com --output ./output --platform=auto
```

If the package is linked or published:

```bash
npx site-migrate https://example.com
```

### Example output

```text
output/
  pages/
    home.md
    about.md
  blog/
    first-post.md
  portfolio/
    gallery.md
  images/
    portfolio/
    blog/
    pages/
    thumbs/
  image-review.json
  navigation.json
  sitemap.json
  metadata.json
  pages.json
  report.md
```

## CLI

```bash
site-migrate <url> [options]
site-migrate import <pack...> --target <astro-clone>
site-migrate verify-gallery <pack> [--target <astro-clone>]
```

| Option                         | Default           | Description                                                        |
| ------------------------------ | ----------------- | ------------------------------------------------------------------ |
| `--output <dir>`               | `output`          | Output directory                                                   |
| `--depth <n>`                  | `10`              | Max crawl depth                                                    |
| `--platform <name>`            | `auto`            | `auto`, `generic`, `wix`, `wordpress`, `webflow`, `squarespace`, … |
| `--paths <list>`               | `/about,/contact` | Extra seed paths (comma-separated)                                 |
| `--timeout`                    | `90000`           | Playwright navigation timeout (ms)                                 |
| `--settle-ms <n>`              | `2500`            | Wait after `networkidle` so JS galleries hydrate                   |
| `--headless` / `--no-headless` | headless          | Browser mode                                                       |
| `--resume`                     | off               | Recrawl only URLs that still have no cached HTML                   |
| `--overwrite`                  | off               | Replace existing output directory                                  |
| `--skip-images`                | off               | Skip image downloads                                               |
| `--skip-blog`                  | off               | Do not classify pages as blog posts                                |
| `--skip-prune`                 | off               | Do not write `<pack>/pruned` after migrate                         |
| `--no-respect-robots`          | off               | Ignore robots.txt                                                  |
| `--concurrency <n>`            | `2`               | Parallel crawl/download workers                                    |
| `--responsive-images`          | off               | Generate width variants with Sharp                                 |
| `--json-export`                | off               | Also write `content.json`                                          |
| `--verbose`                    | off               | Debug logging                                                      |

### Import into an Astro clone

```bash
site-migrate import ./output/pruned --target /path/to/astro-clone --locale en
```

`--target` is required. Import `<pack>/pruned`, not the raw crawl. Protected slugs (`home`, `about`, `contact`) are skipped in every collection unless `--overwrite-pages` / `--overwrite-entries`. Chrome and other-host images stay out of `public/images/` unless `--include-flagged`. `inline-blog` and `title-name-in-media` are review labels and copy by default. Body `/images/` refs are copied as well as `heroImage` / `gallery`. ALL CAPS titles are title-cased; glued Wix descriptions are replaced with body prose.

Migrate writes keepers to `<pack>/pruned` by default. Section hubs are dropped even when they have a thumbnail gallery. Re-run heuristics after extractor changes with `migrate --resume` (rewrites `<pack>/pruned`) or:

```bash
site-migrate prune ./packs/client --output ./pruned-data
```

Import `<pack>/pruned`, not `pruned-data/`.

### Verify gallery pairing

```bash
site-migrate verify-gallery ./output/pruned --target /path/to/astro-clone
```

Fails (exit `2`) if a work title/caption is bound to the wrong file: YAML `hash` does not match the bytes on disk, the clone `public/` file differs from the pack, or the same `mediaId` maps to two files. Run this after re-extract or import. Migrate already runs the pack-only check.

## Documentation

- [Architecture](docs/architecture.md)
- [CLI usage](docs/cli.md)
- [Writing platform plugins](docs/plugins.md)
- [Configuration](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Examples](docs/examples.md)

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

MIT
