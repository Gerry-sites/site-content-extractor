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

`--resume` reuses `pages.json`, `html-index.json`, and already-downloaded images. It recrawls **only URLs that still have no cached HTML**, and it keeps every previously cached URL in `pages.json` (resume cannot shrink the pack). Known HTTP 404s and low-value URLs such as `osd.xml` are not recrawled. If every remaining content URL already has HTML, Playwright is not launched. Markdown files not produced in this run are removed so a page cannot linger in both `pages/` and `portfolio/`. After a successful write, migrate also writes `pruned/` inside the pack unless you pass `--skip-prune`.

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
site-migrate https://mysite.com --concurrency 2 --timeout 90000
```

Defaults are `--concurrency 2` and `--timeout 90000`. `--timeout` maps to the Playwright navigation timeout (`timeoutMs` in the config schema). The crawler also scrolls the page and waits until image counts stop growing so JS galleries can hydrate.

### Import a pack into an Astro starter clone

```bash
site-migrate import ./migrated/pruned --target /path/to/astro-clone --locale en
```

Migrate writes keepers to `<pack>/pruned` by default. Import that folder (or a `site-migrate prune` output) rather than the raw pack.

Import copies every `/images/` path in frontmatter **and** the body, not only `heroImage` / `gallery`. The hero is omitted from `gallery`. Filling an existing portfolio or blog entry copies missing binaries, merges gallery paths, and keeps extra clone keys such as `medium` and `featured`. Protected slugs are skipped in **every** collection unless the matching overwrite flag is set, so `portfolio/home.md` does not land.

New titles drop a ` | Sitename` suffix and title-case ALL CAPS Wix document titles (`CAVE` → `Cave`). Chrome-only or glued Wix descriptions (`DRAWINGCAVE 2018 This project…`) are replaced with the first real paragraph when one exists. New entries still dated `1970-01-01` pick up `## 2018` or `2014 - Ongoing` from the body, extracted headings, or a numeric slug such as `1993`. Standalone year headings are then removed from the body.

| Flag                       | Default              | Description                             |
| -------------------------- | -------------------- | --------------------------------------- |
| `--target <dir>`           | (required)           | Astro site with `src/content/config.ts` |
| `--locale <code>`          | `en`                 | Content locale folder                   |
| `--protected-pages <list>` | `home,about,contact` | Slugs skipped in every collection       |
| `--overwrite-pages`        | off                  | Allow replacing protected **pages**     |
| `--overwrite-entries`      | off                  | Replace existing portfolio/blog bodies  |
| `--include-flagged`        | off                  | Copy chrome / other-host images too     |
| `--flag-inline-blog`       | off                  | Also skip images flagged `inline-blog`  |

`inline-blog` and `title-name-in-media` are review labels. Default import copies those files. Chrome and other-host stay out unless `--include-flagged`.

### Verify gallery titles still match the files

```bash
site-migrate verify-gallery ./migrated/pruned --target /path/to/astro-clone --locale en
```

Captions are bound to `mediaId` (when the CMS has one) and the SHA-256 of the file, not to `slug-2.jpg`. This command **exits 2** when:

- YAML `hash` does not match the bytes on disk
- the clone `public/` file at that path is a different work than the pack
- the same `mediaId` maps to two different files or two captions
- a pack gallery file is missing from the clone

Migrate already runs the pack-only check. Run this with `--target` after import, or after a re-extract onto an existing clone.

| Flag              | Default    | Description                                  |
| ----------------- | ---------- | -------------------------------------------- |
| `--target <dir>`  | (optional) | Astro site with `src/content/`               |
| `--locale <code>` | `en`       | Content locale folder when `--target` is set |

### Prune drafts and hub pages before import

Migrate already writes `<pack>/pruned`. Use the standalone command to re-run heuristics, or pass `--skip-prune` on migrate and prune later:

```bash
site-migrate prune ./packs/client --output ./pruned-data
site-migrate import ./packs/client/pruned --target /path/to/astro-clone --locale en
```

The standalone command writes `<output>/<pack-name>` (default `pruned-data/client`). Import `<pack>/pruned` from migrate, not leftover `pruned-data/` folders from an older run.

Drops Wix `copy-of-*` / `hs-*` drafts, placeholder “Click here to add your own text” pages, `home` / `about` / `contact` in every collection, Wix gallery-counter descriptions (`1/1`, `PAINTING1/1`), homepage/section hubs, and WordPress category indexes (including thin `/recipes/{category}` listings).

A hub is dropped **even when it has a thumbnail gallery**: Wix/generic if there are 4+ in-content links and little prose; WordPress if there are 8+ links with little prose, 40+ links, a `/recipes/{slug}` (or similar collection) URL with 2+ links and no real paragraph, or a thumb listing with 3+ links and little prose. Facebook, Instagram, Twitter, and `mailto:` links do not count toward that threshold. Jetpack “Share this / Related” chrome is stripped before those counts. A hero-only page with no gallery and no real paragraph is dropped as thin chrome.

Keepers are cleaned before write: `Title | Sitename` is stripped, ALL CAPS titles are title-cased, glued Wix descriptions are replaced with body prose, year headings and numeric slugs fill `1970-01-01`, the hero is omitted from `gallery`, leftover portfolio body images are promoted into `gallery`, and parent-nav headings that are only a markdown link are removed. Image-heavy Wix work pages are moved into `portfolio/`. Chrome and other-host images are not copied.

After extractor changes, re-run prune (or `migrate --resume`) so `<pack>/pruned` matches current heuristics.

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

| Code | Meaning                                                       |
| ---- | ------------------------------------------------------------- |
| `0`  | Success                                                       |
| `1`  | Fatal error (invalid args, crawl failure, etc.)               |
| `2`  | Completed with validation, coverage, or gallery pairing holes |

## Output files

| File                              | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `pages/*.md`                      | Regular pages                                                     |
| `blog/*.md`                       | Detected blog posts                                               |
| `portfolio/*.md`                  | Gallery / portfolio pages                                         |
| `images/`                         | Downloaded originals                                              |
| `images/thumbs/`                  | WebP thumbnails                                                   |
| `navigation.json`                 | Site nav                                                          |
| `metadata.json`                   | Site-wide metadata                                                |
| `sitemap.json`                    | Discovered URL list                                               |
| `pages.json`                      | Crawl manifest (resume support)                                   |
| `images-manifest.json`            | Image download resume + `mediaId` / `hash` / assigned `sitePaths` |
| `report.md`                       | Human-readable summary (Coverage + Review)                        |
| `html/` / `html-index.json`       | Cached hydrated HTML for `--resume`                               |
| `pruned/`                         | Import-ready keepers (unless `--skip-prune`)                      |
| `image-review.json`               | Flagged chrome / other-host / title-name / inline-blog images     |
| `astro-content.config.example.ts` | Astro collections starter                                         |

`report.md` includes a **Coverage** table: expected HTML (excluding 404s and `osd.xml`), missing HTML, missing Markdown, missing image downloads, leftover remote thumbs, and extra seeds that returned 404 (warnings only). Any coverage hole besides extra-seed 404s makes the CLI exit `2`. When prune runs, exit `2` is based on the **pruned** pack, not raw hubs.
