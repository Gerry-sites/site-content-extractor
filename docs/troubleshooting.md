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

- Heavy client-side rendering — try `--no-headless` and increase wait via code if needed
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

The crawl finished but Markdown validation found errors (missing title/slug/image). Open `report.md` and fix the listed files, or re-run after improving the extractor.

## Wix pages look incomplete

Wix hydrates late. The crawler waits for `networkidle` briefly; for stubborn pages, increase the settle delay in `src/crawler/index.ts` or contribute Wix-specific waits in the Wix extractor.

## Sharp install issues on Windows

Ensure build tools are available, or reinstall:

```bash
npm rebuild sharp
```

## `--platform=wordpress` (or other reserved id) fails

Those ids are reserved in the CLI schema but do not have registered extractors yet. Use `--platform=auto` or an implemented value (`generic`, `wix`, `webflow`, `squarespace`), or [add a plugin](plugins.md).
