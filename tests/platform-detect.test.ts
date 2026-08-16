import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectPlatform } from "../src/detect/platform.js";

const fixtures = path.join(process.cwd(), "tests/fixtures");

describe("platform detection", () => {
  it("detects Wix", async () => {
    const html = readFileSync(path.join(fixtures, "wix.html"), "utf8");
    const result = await detectPlatform({
      url: "https://demo.wixsite.com/mysite",
      html,
      seedUrl: "https://demo.wixsite.com/mysite",
    });
    expect(result.platform).toBe("wix");
    expect(result.confidence).toBeGreaterThan(0.35);
    expect(result.name).toBe("Wix");
  });

  it("detects Webflow", async () => {
    const html = readFileSync(path.join(fixtures, "webflow.html"), "utf8");
    const result = await detectPlatform({
      url: "https://example.webflow.io",
      html,
      seedUrl: "https://example.webflow.io",
    });
    expect(result.platform).toBe("webflow");
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  it("detects Squarespace", async () => {
    const html = readFileSync(path.join(fixtures, "squarespace.html"), "utf8");
    const result = await detectPlatform({
      url: "https://example.squarespace.com",
      html,
      seedUrl: "https://example.squarespace.com",
    });
    expect(result.platform).toBe("squarespace");
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  it("detects WordPress", async () => {
    const html = readFileSync(path.join(fixtures, "wordpress.html"), "utf8");
    const result = await detectPlatform({
      url: "https://blog.example.com/",
      html,
      seedUrl: "https://blog.example.com/",
    });
    expect(result.platform).toBe("wordpress");
    expect(result.confidence).toBeGreaterThan(0.35);
  });

  it("falls back to generic for plain HTML", async () => {
    const html = readFileSync(path.join(fixtures, "sample.html"), "utf8");
    const result = await detectPlatform({
      url: "https://example.com",
      html,
      seedUrl: "https://example.com",
    });
    expect(result.platform).toBe("generic");
  });
});
