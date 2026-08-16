# Troubleshooting

## Playwright browser missing

```
Executable doesn't exist at ...
```

Install Chromium:

```bash
npx playwright install chromium
```

## Output directory already exists

Use one of:

```bash
site-migrate https://example.com --overwrite
site-migrate https://example.com --resume
```

## Empty or sparse Markdown

Common causes:

- Heavy client-side rendering — try `--no-headless` and `--settle-ms 5000`
- Wrong extractor — force `--platform=wix` (or another) when auto-detect is wrong
- Content lives outside `<main>` — extend the platform extractor’s container selectors

## Images still remote in Markdown

Images failed to download (network/403/hotlink protection). Check `report.md` → Broken Images.

## robots.txt blocked pages

```bash
site-migrate https://example.com --no-respect-robots
```

Only use this for sites you own or are authorized to migrate.

## Validation exit code 2

The crawl finished but Markdown validation or **coverage** found errors (missing HTML, missing images, leftover remote thumbs, missing title/slug). Open `report.md` → Coverage and fix, or re-run with `--resume` to fill holes.

## Wix pages look incomplete

Wix hydrates late. The crawler waits for `networkidle`, then `--settle-ms` (default 2500), clicks Load more, scrolls, and waits until image counts stabilize. Increase `--settle-ms` or `--timeout` for stubborn Pro Galleries. Image fetches send a `Referer` of the seed origin.

`--resume` only recrawls pages that still have no HTML in `html-index.json`.

## Sharp install issues on Windows

Ensure build tools are available, or reinstall:

```bash
npm rebuild sharp
```

## `--platform=ghost` (or other reserved id) fails

Those ids are reserved in the CLI schema but do not have registered extractors yet. Use `--platform=auto` or an implemented value (`generic`, `wix`, `wordpress`, `webflow`, `squarespace`), or [add a plugin](plugins.md).
