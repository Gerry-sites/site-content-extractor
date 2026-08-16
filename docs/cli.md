# CLI usage

## Install / run

```bash
npm install
npx playwright install chromium
npm run build

# run
node dist/cli/index.js https://example.com

# or during development
npm run dev -- https://example.com --verbose
```

If published to npm:

```bash
npx site-migrate https://example.com
```

## Common recipes

### Basic migration

```bash
site-migrate https://mysite.com --output ./migrated
```

### Force Wix extractor

```bash
site-migrate https://mysite.com --platform=wix
```

### Resume an interrupted run

```bash
site-migrate https://mysite.com --output ./migrated --resume
```

### Skip images (content-only pass)

```bash
site-migrate https://mysite.com --skip-images
```

### Ignore robots.txt (use responsibly)

```bash
site-migrate https://mysite.com --no-respect-robots
```

### Visible browser for debugging

```bash
site-migrate https://mysite.com --no-headless --verbose
```

### Extra seeds and JS settle time

```bash
site-migrate https://mysite.com --paths=/about,/contact,/gallery --settle-ms 4000
```

Default extra seeds are `/about` and `/contact`. `--settle-ms` waits after `networkidle` so Wix Pro Gallery and WordPress infinite scroll can hydrate.

### Tune crawl parallelism and timeouts

```bash
site-migrate https://mysite.com --concurrency 5 --timeout 60000
```

`--timeout` maps to the Playwright navigation timeout (`timeoutMs` in the config schema).

### Import a pack into an Astro starter clone

```bash
site-migrate import ./migrated --target /path/to/astro-clone --locale en
```

| Flag                       | Default              | Description                               |
| -------------------------- | -------------------- | ----------------------------------------- |
| `--target <dir>`           | (required)           | Astro site with `src/content/config.ts`   |
| `--locale <code>`          | `en`                 | Content locale folder                     |
| `--protected-pages <list>` | `home,about,contact` | Page slugs that are not overwritten       |
| `--overwrite-pages`        | off                  | Allow replacing protected pages           |
| `--overwrite-entries`      | off                  | Replace existing portfolio/blog bodies    |
| `--include-flagged`        | off                  | Copy flagged images into `public/images/` |
| `--no-flag-inline-blog`    | off                  | Treat `inline-blog` flags as unflagged    |

## Implemented platforms

| `--platform`  | Status                                                      |
| ------------- | ----------------------------------------------------------- |
| `auto`        | Detect from HTML/URL signals                                |
| `generic`     | Plain HTML extractor                                        |
| `wix`         | Dedicated Wix cleanup + containers                          |
| `wordpress`   | Dedicated REST/feed discovery + `.entry-content` extraction |
| `webflow`     | Detection + generic extraction                              |
| `squarespace` | Detection + generic extraction                              |

Other enum values (`ghost`, `framer`, …) are reserved for future plugins — selecting them before a plugin is registered will fail.

## Exit codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| `0`  | Success                                         |
| `1`  | Fatal error (invalid args, crawl failure, etc.) |
| `2`  | Completed with validation errors                |

## Output files

| File                              | Purpose                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `pages/*.md`                      | Regular pages                                                 |
| `blog/*.md`                       | Detected blog posts                                           |
| `portfolio/*.md`                  | Gallery / portfolio pages                                     |
| `images/`                         | Downloaded originals                                          |
| `images/thumbs/`                  | WebP thumbnails                                               |
| `navigation.json`                 | Site nav                                                      |
| `metadata.json`                   | Site-wide metadata                                            |
| `sitemap.json`                    | Discovered URL list                                           |
| `pages.json`                      | Crawl manifest (resume support)                               |
| `images-manifest.json`            | Image download resume support                                 |
| `report.md`                       | Human-readable summary (includes Review section)              |
| `image-review.json`               | Flagged chrome / other-host / title-name / inline-blog images |
| `astro-content.config.example.ts` | Astro collections starter                                     |
