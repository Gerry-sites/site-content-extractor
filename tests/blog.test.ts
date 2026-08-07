import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import {
  extractBlogMeta,
  looksLikeBlogPost,
} from "../src/extractors/shared/blog.js";
import { genericExtractor } from "../src/extractors/generic/index.js";
import { generateMarkdown } from "../src/markdown/generate.js";
import { parseFrontmatter } from "../src/markdown/frontmatter.js";

const fixtures = path.join(process.cwd(), "tests/fixtures");

describe("blog detection", () => {
  it("detects blog posts from URL and article metadata", () => {
    const html = readFileSync(path.join(fixtures, "blog.html"), "utf8");
    const $ = cheerio.load(html);

    expect(
      looksLikeBlogPost("https://example.com/blog/shipping-faster", $),
    ).toBe(true);
    expect(looksLikeBlogPost("https://example.com/about", $)).toBe(true);
  });

  it("does not treat plain pages as blog posts", () => {
    const html = readFileSync(path.join(fixtures, "sample.html"), "utf8");
    const $ = cheerio.load(html);
    expect(looksLikeBlogPost("https://example.com/about", $)).toBe(false);
  });

  it("extracts date, author, categories, and tags", () => {
    const html = readFileSync(path.join(fixtures, "blog.html"), "utf8");
    const $ = cheerio.load(html);
    const meta = extractBlogMeta(
      $,
      "Shipping Faster",
      "https://example.com/blog/shipping-faster",
    );

    expect(meta.date).toContain("2024-06-15");
    expect(meta.author).toBe("Ada Lovelace");
    expect(meta.categories).toContain("Engineering");
    expect(meta.tags).toEqual(expect.arrayContaining(["devops", "process"]));
    expect(meta.slug).toBe("shipping-faster");
  });

  it("writes blog markdown under blog/ with post frontmatter", async () => {
    const html = readFileSync(path.join(fixtures, "blog.html"), "utf8");
    const page = await genericExtractor.extractPage({
      url: "https://example.com/blog/shipping-faster",
      html,
      seedUrl: "https://example.com/",
    });

    expect(page.isBlogPost).toBe(true);
    expect(page.blog?.author).toBe("Ada Lovelace");

    const md = generateMarkdown(
      page,
      new Map([["https://example.com/images/ship.jpg", "../images/ship.jpg"]]),
    );
    expect(md.relativePath).toBe("blog/shipping-faster.md");

    const { frontmatter } = parseFrontmatter(md.content);
    expect(frontmatter.title).toBe("Shipping Faster");
    expect(frontmatter.author).toBe("Ada Lovelace");
    expect(frontmatter.date).toContain("2024-06-15");
    expect(frontmatter.tags).toEqual(
      expect.arrayContaining(["devops", "process"]),
    );
  });
});
