# Configuration

CLI flags are validated with Zod (`src/types/config.ts`).

## Options reference

| Field                | Type            | Default              | Notes                                        |
| -------------------- | --------------- | -------------------- | -------------------------------------------- |
| `url`                | URL string      | required             | Seed URL                                     |
| `output`             | string          | `output`             | Absolute or relative path                    |
| `depth`              | positive int    | `10`                 | Crawl depth from seed                        |
| `images`             | boolean         | `true`               | Master image toggle                          |
| `markdown`           | boolean         | `true`               | Generate `.md` files                         |
| `verbose`            | boolean         | `false`              | Debug logs                                   |
| `headless`           | boolean         | `true`               | Playwright headless                          |
| `resume`             | boolean         | `false`              | Reuse `pages.json` + image manifest          |
| `overwrite`          | boolean         | `false`              | Wipe output first                            |
| `skipImages`         | boolean         | `false`              | Alias-style skip                             |
| `skipBlog`           | boolean         | `false`              | Force pages into `pages/`                    |
| `platform`           | enum            | `auto`               | Extractor selection                          |
| `respectRobots`      | boolean         | `true`               | Honor robots.txt                             |
| `concurrency`        | positive int    | `3`                  | Parallelism                                  |
| `timeoutMs`          | positive int    | `30000`              | Navigation timeout (`--timeout` on the CLI)  |
| `settleMs`           | nonnegative int | `2500`               | Wait after `networkidle` (`--settle-ms`)     |
| `paths`              | string[]        | `/about`, `/contact` | Extra seed paths (`--paths`)                 |
| `generateResponsive` | boolean         | `false`              | Sharp width variants (`--responsive-images`) |
| `jsonExport`         | boolean         | `false`              | Emit `content.json` (`--json-export`)        |
| `userAgent`          | string          | `site-migrate/0.1 …` | HTTP + browser UA                            |

`platform` accepts `auto` plus platform ids. Registered extractors today: `generic`, `wix`, `wordpress`, `webflow`, `squarespace`.

## Programmatic use

```ts
import { runMigration } from "site-migrate";

const result = await runMigration({
  url: "https://example.com",
  output: "./output",
  depth: 5,
  images: true,
  markdown: true,
  verbose: true,
  headless: true,
  resume: false,
  overwrite: true,
  skipImages: false,
  skipBlog: false,
  platform: "auto",
  respectRobots: true,
  concurrency: 3,
  timeoutMs: 30_000,
  settleMs: 2_500,
  paths: ["/about", "/contact"],
  generateResponsive: false,
  jsonExport: false,
  userAgent: "site-migrate/0.1",
});
```

## Astro import

```bash
site-migrate import ./output --target /path/to/astro-clone --locale en
```

The importer copies new `portfolio/` and `blog/` slugs into `src/content/{collection}/{locale}/` and unflagged binaries into `public/images/`. Protected pages (`home`, `about`, `contact`) are not overwritten unless `--overwrite-pages`. Review `image-review.json` first.
