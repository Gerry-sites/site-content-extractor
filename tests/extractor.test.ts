import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { genericExtractor } from "../src/extractors/generic/index.js";
import { wixExtractor } from "../src/extractors/wix/index.js";
import { wordpressExtractor } from "../src/extractors/wordpress/index.js";
import { packFolder } from "../src/pack/paths.js";

const fixtures = path.join(process.cwd(), "tests/fixtures");

describe("generic extractor", () => {
  it("extracts meaningful content and strips chrome", async () => {
    const html = readFileSync(path.join(fixtures, "sample.html"), "utf8");
    const page = await genericExtractor.extractPage({
      url: "https://example.com/",
      html,
      seedUrl: "https://example.com/",
    });

    expect(page.title).toBe("Acme Studio");
    expect(page.description).toContain("portfolio");
    expect(page.htmlContent).toContain("Welcome to Acme");
    expect(page.htmlContent).not.toContain("Accept cookies");
    expect(page.images.length).toBeGreaterThanOrEqual(1);
    expect(page.galleries.length).toBeGreaterThanOrEqual(1);
    expect(page.videos.some((v) => v.provider === "youtube")).toBe(true);
    expect(page.files.some((f) => f.href.includes("press.pdf"))).toBe(true);
  });

  it("extracts navigation and metadata", async () => {
    const html = readFileSync(path.join(fixtures, "sample.html"), "utf8");
    const ctx = {
      url: "https://example.com/",
      html,
      seedUrl: "https://example.com/",
    };
    const nav = await genericExtractor.extractNavigation!(ctx);
    const meta = await genericExtractor.extractMetadata!(ctx);

    expect(nav.some((n) => n.title === "About")).toBe(true);
    expect(meta.siteTitle).toBeTruthy();
    expect(meta.socialLinks.some((s) => s.platform === "instagram")).toBe(true);
  });
});

describe("wix extractor", () => {
  it("scores and extracts Wix pages", async () => {
    const html = readFileSync(path.join(fixtures, "wix.html"), "utf8");
    const score = await wixExtractor.detect({
      url: "https://demo.wixsite.com/mysite",
      html,
      seedUrl: "https://demo.wixsite.com/mysite",
    });
    expect(score).toBeGreaterThan(0.5);

    const page = await wixExtractor.extractPage({
      url: "https://demo.wixsite.com/mysite",
      html,
      seedUrl: "https://demo.wixsite.com/mysite",
    });
    expect(page.title).toContain("Wix");
    expect(page.htmlContent).toContain("Hello from Wix");
    expect(page.htmlContent).not.toContain("WIX_ADS");
  });

  it("treats image-heavy Pro Gallery pages as galleries and keeps about as a page", async () => {
    const galleryHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta name="generator" content="Wix.com Website Builder" />
    <title>Works</title>
    <script src="https://static.wixstatic.com/services.js"></script>
  </head>
  <body>
    <div id="SITE_PAGES">
      <div data-testid="pro-gallery">
        <span>1 / 8</span>
        <img src="https://static.wixstatic.com/media/v1/fill/w_290,h_290,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/one.jpg" alt="One" />
        <img src="https://static.wixstatic.com/media/v1/fill/w_290,h_290,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/two.jpg" alt="Two" />
        <img src="https://static.wixstatic.com/media/v1/fill/w_290,h_290,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/three.jpg" alt="Three" />
        <img src="https://static.wixstatic.com/media/v1/fill/w_290,h_290,al_c,q_80,usm_0.66_1.00_0.01,enc_auto/four.jpg" alt="Four" />
      </div>
    </div>
  </body>
</html>`;
    const gallery = await wixExtractor.extractPage({
      url: "https://studio.example.com/works",
      html: galleryHtml,
      seedUrl: "https://studio.example.com/",
    });
    expect(gallery.kind).toBe("gallery");
    expect(gallery.kind).not.toBe("page");
    expect(gallery.images.length).toBeGreaterThanOrEqual(4);
    expect(gallery.images.every((img) => img.src.includes("/v1/fit/w_1800"))).toBe(true);

    const about = await wixExtractor.extractPage({
      url: "https://studio.example.com/about",
      html: readFileSync(path.join(fixtures, "wix.html"), "utf8"),
      seedUrl: "https://studio.example.com/",
    });
    expect(about.kind).toBe("page");
    expect(packFolder(gallery.kind, gallery.isBlogPost)).toBe("portfolio");
    expect(packFolder(about.kind, about.isBlogPost)).toBe("pages");
    expect(packFolder(gallery.kind, gallery.isBlogPost)).not.toBe(
      packFolder(about.kind, about.isBlogPost),
    );
  });

  it("keeps off-screen Wix Pro Gallery tiles that are aria-hidden", async () => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="generator" content="Wix.com Website Builder" />
    <title>Landscape</title>
  </head>
  <body>
    <div id="SITE_PAGES">
      <h1>LANDSCAPE</h1>
      <div class="pro-gallery">
        <img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/bfe860_ba5277b4149749098d8f26734610ca73~mv2.jpg/v1/fill/w_323,h_322,q_90/a.jpg" alt="One" />
        <div aria-hidden="true">
          <img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/bfe860_4dbc7394010a41ddb17c7281739d14a2~mv2.jpg/v1/fill/w_322,h_322,q_90/b.jpg" alt="Two" />
          <img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/bfe860_c5726b1bf81c40c98b84ccaceef4c6a6~mv2.jpg/v1/fill/w_323,h_322,q_90/c.jpg" alt="Three" />
          <img data-hook="gallery-item-image-img" src="https://static.wixstatic.com/media/bfe860_1ea6fb161fbd4d4b973d6d43b1568fb8~mv2.jpg/v1/fill/w_322,h_322,q_90/d.jpg" alt="Four" />
        </div>
      </div>
    </div>
  </body>
</html>`;
    const page = await wixExtractor.extractPage({
      url: "https://studio.example.com/landscape",
      html,
      seedUrl: "https://studio.example.com/",
    });
    expect(page.images.length).toBeGreaterThanOrEqual(4);
    expect(page.images.every((img) => img.src.includes("/v1/fit/w_1800"))).toBe(true);
    expect(page.kind).toBe("gallery");
  });
});

describe("wordpress extractor", () => {
  it("extracts entry-content and upgrades cropped media URLs", async () => {
    const html = readFileSync(path.join(fixtures, "wordpress.html"), "utf8");
    const score = await wordpressExtractor.detect({
      url: "https://blog.example.com/2020/01/hello/",
      html,
      seedUrl: "https://blog.example.com/",
    });
    expect(score).toBeGreaterThan(0.5);

    const page = await wordpressExtractor.extractPage({
      url: "https://blog.example.com/2020/01/hello/",
      html,
      seedUrl: "https://blog.example.com/",
    });
    expect(page.kind).toBe("blog");
    expect(page.htmlContent).toContain("bilingual recipe");
    expect(page.images.some((img) => img.src.includes("dish.jpg"))).toBe(true);
    expect(page.images.some((img) => /[?&]w=300/.test(img.src))).toBe(false);
  });
});
