# site-migrate

Migrate publicly accessible websites into clean Markdown and structured assets suitable for [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

The tool prioritizes **content extraction** over layout reproduction. Although Wix is a first-class target, the architecture is plugin-based so other platforms (Squarespace, Webflow, WordPress, and plain HTML) can be added without changing the crawler.

## Features

- Playwright-based crawling with sitemap + navigation discovery
- robots.txt respect (override available)
- Platform auto-detection (`wix`, `webflow`, `squarespace`, `generic`)
- Clean HTML → Markdown with YAML frontmatter
- Image download, hash deduplication, thumbnails
- Gallery + blog post detection
- `navigation.json`, `metadata.json`, `sitemap.json`, `report.md`
- Output validation (titles, slugs, image refs)

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
  images/
    thumbs/
  navigation.json
  sitemap.json
  metadata.json
  pages.json
  report.md
```

## CLI

```bash
site-migrate <url> [options]
```

| Option | Default | Description |
| --- | --- | --- |
| `--output <dir>` | `output` | Output directory |
| `--depth <n>` | `10` | Max crawl depth |
| `--platform <name>` | `auto` | `auto`, `generic`, `wix`, `webflow`, `squarespace`, … |
| `--headless` / `--no-headless` | headless | Browser mode |
| `--resume` | off | Resume from existing `pages.json` / image manifest |
| `--overwrite` | off | Replace existing output directory |
| `--skip-images` | off | Skip image downloads |
| `--skip-blog` | off | Do not classify pages as blog posts |
| `--no-respect-robots` | off | Ignore robots.txt |
| `--concurrency <n>` | `3` | Parallel crawl/download workers |
| `--responsive-images` | off | Generate width variants with Sharp |
| `--json-export` | off | Also write `content.json` |
| `--verbose` | off | Debug logging |

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
