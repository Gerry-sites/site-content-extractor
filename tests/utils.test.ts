import { describe, expect, it } from "vitest";
import {
  isInternalLink,
  normalizeUrl,
  pathFromUrl,
  isImageUrl,
} from "../src/utils/url.js";
import { sanitizeFilename, toSlug, uniqueSlug } from "../src/utils/slug.js";
import { sha256, shortHash } from "../src/utils/hash.js";

describe("url utils", () => {
  it("normalizes URLs deterministically", () => {
    expect(normalizeUrl("https://Example.com/About/?utm_source=x#hash")).toBe(
      "https://example.com/About",
    );
    expect(normalizeUrl("https://example.com/a/?b=2&a=1")).toBe(
      "https://example.com/a?a=1&b=2",
    );
  });

  it("detects internal links", () => {
    expect(isInternalLink("/about", "https://example.com")).toBe(true);
    expect(isInternalLink("https://example.com/x", "https://example.com")).toBe(
      true,
    );
    expect(isInternalLink("https://other.com/x", "https://example.com")).toBe(
      false,
    );
    expect(isInternalLink("mailto:hi@example.com", "https://example.com")).toBe(
      false,
    );
  });

  it("derives path slugs from URLs", () => {
    expect(pathFromUrl("https://example.com/")).toBe("home");
    expect(pathFromUrl("https://example.com/about/team")).toBe("about/team");
  });

  it("detects image URLs", () => {
    expect(isImageUrl("https://cdn.example.com/a/b.jpg")).toBe(true);
    expect(isImageUrl("https://cdn.example.com/a/b.pdf")).toBe(false);
  });
});

describe("slug utils", () => {
  it("slugifies titles", () => {
    expect(toSlug("Hello World!")).toBe("hello-world");
    expect(toSlug("")).toBe("page");
  });

  it("creates unique slugs", () => {
    const used = new Set<string>();
    expect(uniqueSlug("About", used)).toBe("about");
    expect(uniqueSlug("About", used)).toBe("about-2");
    expect(uniqueSlug("About", used)).toBe("about-3");
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../evil name?.jpg")).toBe("evil-name-.jpg");
    expect(sanitizeFilename("photo.jpg?width=400")).toBe("photo.jpg");
    expect(sanitizeFilename("")).toBe("file");
  });
});

describe("hash utils", () => {
  it("hashes buffers deterministically", () => {
    const a = sha256("hello");
    const b = sha256("hello");
    expect(a).toBe(b);
    expect(shortHash("hello", 8)).toHaveLength(8);
  });
});
