import { describe, expect, it } from "vitest";
import { generateMarkdown } from "../src/markdown/generate.js";
import { parseFrontmatter } from "../src/markdown/frontmatter.js";
import { htmlToMarkdown } from "../src/markdown/turndown.js";
import type { ExtractedPage } from "../src/types/schemas.js";

describe("markdown generation", () => {
  it("converts HTML to clean markdown", () => {
    const md = htmlToMarkdown(
      "<h1>Hello</h1><p>World</p><ul><li>One</li><li>Two</li></ul>",
    );
    expect(md).toContain("# Hello");
    expect(md).toContain("World");
    expect(md).toMatch(/-\s+One/);
    expect(md).toMatch(/-\s+Two/);
  });

  it("writes frontmatter with title and slug", () => {
    const page: ExtractedPage = {
      url: "https://example.com/about",
      title: "About Us",
      description: "Who we are",
      slug: "about",
      headings: ["About Us"],
      htmlContent: "<h1>About Us</h1><p>We build things.</p><img src=\"https://cdn.example.com/a.jpg\" alt=\"A\" />",
      images: [{ src: "https://cdn.example.com/a.jpg", alt: "A", role: "content" }],
      links: [],
      videos: [],
      files: [],
      galleries: [],
      isBlogPost: false,
      kind: "page",
    };

    const imagePaths = new Map([
      ["https://cdn.example.com/a.jpg", "../images/a.jpg"],
    ]);

    const result = generateMarkdown(page, imagePaths);
    expect(result.relativePath).toBe("pages/about.md");

    const { frontmatter, body } = parseFrontmatter(result.content);
    expect(frontmatter.title).toBe("About Us");
    expect(frontmatter.slug).toBe("about");
    expect(body).toContain("../images/a.jpg");
    expect(body).not.toContain("https://cdn.example.com/a.jpg");
  });

  it("emits gallery frontmatter for gallery pages", () => {
    const page: ExtractedPage = {
      url: "https://example.com/gallery",
      title: "Gallery",
      slug: "gallery",
      headings: [],
      htmlContent: "<div></div>",
      images: [],
      links: [],
      videos: [],
      files: [],
      galleries: [
        {
          images: [
            "https://cdn.example.com/1.jpg",
            "https://cdn.example.com/2.jpg",
            "https://cdn.example.com/3.jpg",
          ],
        },
      ],
      isBlogPost: false,
      kind: "gallery",
    };

    const imagePaths = new Map([
      ["https://cdn.example.com/1.jpg", "../images/1.jpg"],
      ["https://cdn.example.com/2.jpg", "../images/2.jpg"],
      ["https://cdn.example.com/3.jpg", "../images/3.jpg"],
    ]);

    const result = generateMarkdown(page, imagePaths);
    const { frontmatter } = parseFrontmatter(result.content);
    expect(frontmatter.gallery).toEqual([
      "images/1.jpg",
      "images/2.jpg",
      "images/3.jpg",
    ]);
    expect(result.relativePath).toBe("portfolio/gallery.md");
  });
});
