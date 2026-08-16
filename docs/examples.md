# Examples

## Migrate a marketing site

```bash
site-migrate https://www.example.com \
  --output ./migrations/example \
  --platform=auto \
  --overwrite \
  --verbose
```

Expected highlights:

- `pages/home.md`, `pages/about.md`, …
- `navigation.json` with top-level links
- `metadata.json` with OG/Twitter tags
- `report.md` counts

## Migrate a Wix blog

```bash
site-migrate https://yourname.wixsite.com/site \
  --platform=wix \
  --output ./migrations/wix-blog
```

Blog-like URLs (`/post/...`, article OG type, JSON-LD `BlogPosting`) land in `blog/` with `date`, `author`, `tags` when available.

## Content-only dry run

```bash
site-migrate https://example.com \
  --skip-images \
  --depth 2 \
  --output ./dry-run
```

Useful to inspect Markdown quality before downloading large media libraries.

## Resume after failure

```bash
site-migrate https://example.com --output ./migrations/example --resume
```

Reuses:

- `pages.json` discovered URLs
- `images-manifest.json` already-downloaded binaries

## Export JSON for custom importers

```bash
site-migrate https://example.com --json-export --output ./migrations/example
```

Produces `content.json` with the full extracted page objects.

## Import into an Astro clone

```bash
site-migrate import ./migrations/example/pruned --target /path/to/astro-clone --locale en
```

Import the pruned folder, not the raw pack. Protected slugs (`home`, `about`, `contact`) are skipped in every collection unless `--overwrite-pages` / `--overwrite-entries`. Chrome and other-host stay out of `public/images/` unless `--include-flagged`. Body `/images/` refs are copied with the hero and gallery.

`inline-blog` and `title-name-in-media` are review labels and copy by default. Pass `--flag-inline-blog` only when those inlines should stay out of `public/images/`.

## Operator live checks

These commands are examples only. Hostnames are **not** encoded in `src/`. After a generic change, optionally run:

```bash
site-migrate https://www.example.com/ --platform=auto --output ./packs/example --overwrite
site-migrate https://www.jeffmidghall.com/ --platform=wix --output ./packs/jeff --overwrite
site-migrate https://www.byserafin.com/ --platform=wix --output ./packs/agatha --overwrite
site-migrate https://cuisineandart.com/ --platform=wordpress --output ./packs/cuisine --overwrite
```

Acceptance for a live pack: upgraded `w_1800` JPEGs (not `w_290` thumbs); about/contact text present when those URLs exist (a 404 extra seed is a warning); WordPress post count in the same ballpark as the live index; originals without `crop=1` or `?w=`; flagged inline illustrations in `image-review.json`. Import `<pack>/pruned`, not `pruned-data/`. Dry-run import must leave About untouched. Prefer `--resume` over `--overwrite` when HTML is already cached.
