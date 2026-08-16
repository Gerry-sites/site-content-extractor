import { describe, expect, it } from "vitest";
import {
  buildCoverage,
  coverageHasHoles,
  leftoverRemoteUrls,
  missingHtmlUrls,
  missingImageUrls,
} from "../src/pack/coverage.js";
import type { DiscoveredPage, ExtractedPage } from "../src/types/schemas.js";

const page = (url: string, status?: number): DiscoveredPage => ({
  url,
  normalizedUrl: url.replace(/\/$/, ""),
  depth: 0,
  source: "seed",
  status,
});

describe("coverage", () => {
  it("treats discovered URLs without HTML as holes, except 404s", () => {
    const pages = [
      page("https://studio.example.com/about"),
      page("https://studio.example.com/contact", 404),
      page("https://studio.example.com/works"),
    ];
    const htmlByUrl = new Map([["https://studio.example.com/works", "<html></html>"]]);
    const missing = missingHtmlUrls(pages, htmlByUrl);
    expect(missing).toContain("https://studio.example.com/about");
    expect(missing).not.toContain("https://studio.example.com/contact");
    expect(missing).not.toContain("https://studio.example.com/works");
  });

  it("fails coverageHasHoles when leftover remote images remain", () => {
    const extracted: ExtractedPage[] = [
      {
        url: "https://studio.example.com/works",
        title: "Works",
        slug: "works",
        headings: [],
        htmlContent: "<div></div>",
        images: [],
        links: [],
        videos: [],
        files: [],
        galleries: [],
        isBlogPost: false,
        kind: "gallery",
      },
    ];
    const coverage = buildCoverage({
      pages: [page("https://studio.example.com/works")],
      htmlByUrl: new Map([["https://studio.example.com/works", "<p>ok</p>"]]),
      extracted,
      writtenByUrl: new Map([["https://studio.example.com/works", "portfolio/works.md"]]),
      imagePathMap: new Map(),
      brokenImages: [],
      markdownContents: [
        "![Art](https://static.wixstatic.com/media/photo.jpg/v1/fill/w_290,h_290/photo.jpg)\n",
      ],
      seedMissing: [],
    });
    expect(coverage.leftoverRemote.length).toBeGreaterThan(0);
    expect(coverageHasHoles(coverage)).toBe(true);
  });

  it("does not treat skippable chrome URLs as leftover remotes", () => {
    const urls = leftoverRemoteUrls(
      "![fb](https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png)\n",
    );
    expect(urls).toEqual([]);
  });

  it("treats extra-seed 404s as warnings, not coverage holes", () => {
    const coverage = buildCoverage({
      pages: [page("https://studio.example.com/"), page("https://studio.example.com/contact", 404)],
      htmlByUrl: new Map([["https://studio.example.com", "<p>home</p>"]]),
      extracted: [],
      writtenByUrl: new Map(),
      imagePathMap: new Map(),
      brokenImages: [],
      markdownContents: ["# Home\n"],
      seedMissing: [{ path: "/contact", status: 404 }],
    });
    expect(coverage.missingHtml).toEqual([]);
    expect(coverageHasHoles(coverage)).toBe(false);
    expect(coverage.seedMissing).toEqual([{ path: "/contact", status: 404 }]);
  });

  it("does not count skippable chrome as missing images", () => {
    const extracted: ExtractedPage[] = [
      {
        url: "https://studio.example.com/about",
        title: "About",
        slug: "about",
        headings: [],
        htmlContent: "<p>Hi</p>",
        images: [
          {
            src: "https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png",
            role: "content",
          },
        ],
        links: [],
        videos: [],
        files: [],
        galleries: [],
        isBlogPost: false,
        kind: "page",
      },
    ];
    expect(missingImageUrls(extracted, new Map(), new Set())).toEqual([]);
  });
});
