import { describe, expect, it } from "vitest";
import { applyTransformers } from "../src/transformers/index.js";
import type { ExtractedPage } from "../src/types/schemas.js";

function basePage(overrides: Partial<ExtractedPage> = {}): ExtractedPage {
  return {
    url: "https://example.com/about",
    title: "About",
    slug: "about",
    headings: [],
    htmlContent: "<p>Hello</p>",
    images: [],
    links: [],
    videos: [],
    files: [],
    galleries: [],
    isBlogPost: false,
    kind: "page",
    ...overrides,
  };
}

describe("page transformers", () => {
  it("applies transformers in order", async () => {
    const result = await applyTransformers(basePage(), [
      (page) => ({ ...page, title: `${page.title}!` }),
      async (page) => ({ ...page, slug: "about-us" }),
    ]);

    expect(result.title).toBe("About!");
    expect(result.slug).toBe("about-us");
  });

  it("returns the original page when no transformers are provided", async () => {
    const page = basePage();
    const result = await applyTransformers(page, []);
    expect(result).toEqual(page);
  });
});
