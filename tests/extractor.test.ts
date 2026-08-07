import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { genericExtractor } from "../src/extractors/generic/index.js";
import { wixExtractor } from "../src/extractors/wix/index.js";

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
});
