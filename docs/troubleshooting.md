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

Discovered URLs that 404 (deleted posts, a missing `/contact` extra seed, `osd.xml`) stay listed in `pages.json` on resume. Extra-seed 404s are warnings. A pruned pack can still be import-ready when the raw pack exits 2 for those dead URLs.

## Wix pages look incomplete

Wix hydrates late. The crawler waits for `networkidle`, then `--settle-ms` (default 2500), clicks Load more, scrolls, and waits until image counts stabilize. Increase `--settle-ms` or `--timeout` for stubborn Pro Galleries. Image fetches send a `Referer` of the seed origin.

`--resume` only recrawls pages that still have no HTML in `html-index.json`. Cached URLs stay in `pages.json`. Known HTTP 404s and `osd.xml` are not recrawled. If every remaining content URL already has HTML, the browser is not launched. Video URLs and tokenized Wix storefront assets are not coverage holes.

## Sharp install issues on Windows

Ensure build tools are available, or reinstall:

```bash
npm rebuild sharp
```

## `--platform=ghost` (or other reserved id) fails

Those ids are reserved in the CLI schema but do not have registered extractors yet. Use `--platform=auto` or an implemented value (`generic`, `wix`, `wordpress`, `webflow`, `squarespace`), or [add a plugin](plugins.md).

## Import copied pages you did not want

Import `<pack>/pruned`, not the raw crawl. The raw pack still contains `copy-of-*` / `hs-*` drafts and section hubs. After extractor changes, re-run `site-migrate prune` so an older `pruned/` or `pruned-data/` folder is not what you import.

`home`, `about`, and `contact` are dropped at prune and skipped by import in every collection. The clone template for those slugs stays unless you pass `--overwrite-pages` (pages) or `--overwrite-entries` (portfolio/blog).

## Body images 404 in the clone

Current import copies every `/images/` path in the Markdown body as well as `heroImage` / `gallery`. If a WordPress pack still has `?w=` on local paths, re-migrate (or re-prune) so queries are stripped before import. Leftover remote thumbs are a coverage hole in `report.md`, not an import skip.

WordPress inlines are flagged `inline-blog` for review. Default import copies them. If body photos 404, the pack path is missing or you passed `--flag-inline-blog`. Chrome and other-host still skip unless `--include-flagged`.

## Importing `pruned-data/` looks wrong

Migrate writes keepers to `<pack>/pruned`. `pruned-data/` is only the default parent for a standalone `site-migrate prune` if you do not pass `--output`. Older copies there can still have first-wins `home-N.jpg` paths or hubs. Import `<pack>/pruned`.

## Portfolio hubs landed as works

Wix section menus with a thumbnail grid used to survive prune. Current prune drops them when there are 4+ in-content links and little prose, even if `gallery` has 3+ images. Re-prune the pack. Facebook / Instagram / `mailto:` links do not count, so a hero-only page with social icons used to survive. Current prune drops that as `thin-chrome` unless there is a real paragraph or extra gallery images.

## Dates are 1970-01-01

Wix often has no article date. Generate and prune fill `1970-01-01` from a `## 2018` / `2014 - Ongoing` heading or a numeric slug (`1993`). Pages with neither stay on the sentinel date. Filling an existing clone entry does not overwrite the clone’s date.

## Titles are ALL CAPS or `Title | Sitename`

The ` | Sitename` suffix is stripped and ALL CAPS titles are title-cased (`CAVE` → `Cave`). The tool does not rewrite mixed-case titles. Chrome-only descriptions and Wix concatenations (`PAINTINGAMPHORAE Work made…`) are replaced with the first real body paragraph.
