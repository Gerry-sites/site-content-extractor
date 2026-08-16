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
| `--no-respect-robots`          | off               | Ignore robots.txt                                                  |
| `--concurrency <n>`            | `2`               | Parallel crawl/download workers                                    |
| `--responsive-images`          | off               | Generate width variants with Sharp                                 |
| `--json-export`                | off               | Also write `content.json`                                          |
| `--verbose`                    | off               | Debug logging                                                      |

### Import into an Astro clone

```bash
site-migrate import ./output --target /path/to/astro-clone --locale en
```

`--target` is required. Protected pages (`home`, `about`, `contact`) are not overwritten unless `--overwrite-pages`. Flagged images stay out of `public/images/` unless `--include-flagged`.

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
