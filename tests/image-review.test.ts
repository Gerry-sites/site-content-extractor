import { describe, expect, it } from "vitest";
import { reviewImage, titleNameTokens, isSkippedOnImport } from "../src/review/images.js";

describe("image review flags", () => {
  it("flags a blog illustration when a title name appears in the alt text", () => {
    const flags = reviewImage({
      remoteUrl: "https://blog.example.com/wp-content/uploads/painting.jpg",
      pageUrl: "https://blog.example.com/about-gauguin/",
      seedUrl: "https://blog.example.com/",
      alt: "Gauguin painting",
      pageTitle: "About Gauguin",
      isBlogPost: true,
      isHero: false,
      pageKind: "blog",
    });
    expect(flags).toContain("title-name-in-media");
    expect(flags).toContain("inline-blog");
  });

  it("does not flag a gallery image whose alt matches the gallery title", () => {
    const flags = reviewImage({
      remoteUrl: "https://static.wixstatic.com/media/work.jpg",
      pageUrl: "https://studio.example.com/portraits",
      seedUrl: "https://studio.example.com/",
      alt: "Portraits",
      pageTitle: "Portraits",
      isBlogPost: false,
      isHero: true,
      pageKind: "gallery",
    });
    expect(flags).not.toContain("title-name-in-media");
    expect(flags).not.toContain("inline-blog");
  });

  it("flags other hosts and skips stopwords as title tokens", () => {
    expect(titleNameTokens("About Gauguin")).toEqual(["Gauguin"]);
    const flags = reviewImage({
      remoteUrl: "https://cdn.other.example/x.jpg",
      pageUrl: "https://blog.example.com/post",
      seedUrl: "https://blog.example.com/",
      pageTitle: "Notes",
      isBlogPost: true,
      isHero: true,
      pageKind: "blog",
    });
    expect(flags).toContain("other-host");
  });

  it("skips only chrome and other-host on import unless inline-blog is opted in", () => {
    expect(isSkippedOnImport(["inline-blog", "title-name-in-media"], {})).toBe(false);
    expect(isSkippedOnImport(["inline-blog"], { flagInlineBlog: true })).toBe(true);
    expect(isSkippedOnImport(["chrome"], {})).toBe(true);
    expect(isSkippedOnImport(["other-host"], {})).toBe(true);
    expect(isSkippedOnImport(["chrome", "inline-blog"], { includeFlagged: true })).toBe(false);
  });
});
