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
