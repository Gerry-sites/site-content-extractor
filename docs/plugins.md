# Writing platform plugins

Adding a new platform should only require a new extractor module.

## 1. Create the extractor

Create `src/extractors/myplatform/index.ts`:

```ts
import type { PlatformExtractor } from "../types.js";
import { genericExtractor } from "../generic/index.js";

export const myPlatformExtractor: PlatformExtractor = {
  id: "wordpress", // add to PlatformId in src/types/config.ts
  name: "WordPress",

  detect(ctx) {
    let score = 0;
    if (/wp-content/i.test(ctx.html)) score += 0.4;
    if (/<meta[^>]+name=["']generator["'][^>]+wordpress/i.test(ctx.html)) {
      score += 0.5;
    }
    return Math.min(score, 1);
  },

  async extractPage(ctx) {
    // Start from generic, then specialize:
    const page = await genericExtractor.extractPage(ctx);
    // ... WordPress-specific cleanup / blog meta ...
    return page;
  },

  extractNavigation: genericExtractor.extractNavigation,
  extractMetadata: genericExtractor.extractMetadata,
};
```

## 2. Register it

In `src/extractors/registry.ts`:

```ts
import { myPlatformExtractor } from "./myplatform/index.js";

const extractors: PlatformExtractor[] = [
  myPlatformExtractor,
  // ...
  genericExtractor, // keep generic last
];
```

## 3. Extend the CLI union

Add the id to `CliOptionsSchema.platform` and `PlatformId` in `src/types/config.ts`.

## 4. Add detection + extraction tests

```ts
it("detects MyPlatform", async () => {
  const result = await detectPlatform({ url, html, seedUrl: url });
  expect(result.platform).toBe("wordpress");
});
```

## Guidelines

- Prefer Cheerio selectors that target **content containers**, not chrome.
- Remove cookie banners, popups, nav, and footers before Markdown conversion.
- Reuse helpers in `src/extractors/shared/` (`cleanup`, `media`, `blog`, `metadata`).
- Return absolute image URLs; the downloader rewrites them later.
- Keep `detect()` cheap (string/HTML checks only — no network).

## Reserved platform ids

`generic`, `wix`, `webflow`, `squarespace`, `cargo`, `wordpress`, `ghost`, `framer`, `adobe-portfolio`

Implemented today: `generic`, `wix`, `wordpress`, `webflow` (detect + generic extract), `squarespace` (detect + generic extract).

## Testing a plugin

Add fixtures under `tests/fixtures/` and cover:

1. `detect()` confidence above the auto-detect threshold (~0.35)
2. `extractPage()` keeps meaningful content and drops chrome
3. Optional navigation/metadata helpers

```bash
npm test
npm run typecheck
```
