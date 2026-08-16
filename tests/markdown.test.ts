import { describe, expect, it } from "vitest";
import { generateMarkdown } from "../src/markdown/generate.js";
import { parseFrontmatter } from "../src/markdown/frontmatter.js";
import { htmlToMarkdown } from "../src/markdown/turndown.js";
import type { ExtractedPage } from "../src/types/schemas.js";

describe("markdown generation", () => {
  it("converts HTML to clean markdown", () => {
    const md = htmlToMarkdown("<h1>Hello</h1><p>World</p><ul><li>One</li><li>Two</li></ul>");
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
      htmlContent:
        '<h1>About Us</h1><p>We build things.</p><img src="https://cdn.example.com/a.jpg" alt="A" />',
      images: [{ src: "https://cdn.example.com/a.jpg", alt: "A", role: "content" }],
      links: [],
      videos: [],
      files: [],
      galleries: [],
      isBlogPost: false,
      kind: "page",
    };

    const imagePaths = new Map([["https://cdn.example.com/a.jpg", "/images/pages/about.jpg"]]);

    const result = generateMarkdown(page, imagePaths);
    expect(result.relativePath).toBe("pages/about.md");

    const { frontmatter, body } = parseFrontmatter(result.content);
    expect(frontmatter.title).toBe("About Us");
    expect(frontmatter.slug).toBe("about");
    expect(frontmatter.description).toBe("Who we are");
    expect(frontmatter.date).toBeTruthy();
    expect(frontmatter.sourceUrl).toBe("https://example.com/about");
    expect(body).toContain("/images/pages/about.jpg");
    expect(body).not.toContain("https://cdn.example.com/a.jpg");
  });

  it("rewrites cropped Wix URLs using the upgraded download map", () => {
    const cropped =
      "https://static.wixstatic.com/media/photo.jpg/v1/fill/w_215,h_278,al_c,q_80,enc_auto/photo.jpg";
    const upgraded =
      "https://static.wixstatic.com/media/photo.jpg/v1/fit/w_1800,h_1800,al_c,q_85,enc_jpg/photo.jpg";
    const page: ExtractedPage = {
      url: "https://studio.example.com/about",
      title: "About",
      description: "Bio",
      slug: "about",
      headings: [],
      htmlContent: `<p>Hi</p><img src="${cropped}" alt="Portrait" />`,
      images: [{ src: upgraded, alt: "Portrait", role: "hero" }],
      links: [],
      videos: [],
      files: [],
      galleries: [],
      isBlogPost: false,
      kind: "page",
    };
    const result = generateMarkdown(page, new Map([[upgraded, "/images/pages/about-hero.jpg"]]));
    expect(result.content).toContain("/images/pages/about-hero.jpg");
    expect(result.content).not.toContain("static.wixstatic.com");
    expect(result.content).not.toContain("w_215");
  });

  it("emits gallery frontmatter for gallery pages", () => {
    const page: ExtractedPage = {
      url: "https://example.com/gallery",
      title: "Gallery",
      description: "Works",
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
      ["https://cdn.example.com/1.jpg", "/images/portfolio/gallery-hero.jpg"],
      ["https://cdn.example.com/2.jpg", "/images/portfolio/gallery-2.jpg"],
      ["https://cdn.example.com/3.jpg", "/images/portfolio/gallery-3.jpg"],
    ]);

    const result = generateMarkdown(page, imagePaths);
    const { frontmatter } = parseFrontmatter(result.content);
    expect(frontmatter.gallery).toEqual([
      "/images/portfolio/gallery-hero.jpg",
      "/images/portfolio/gallery-2.jpg",
      "/images/portfolio/gallery-3.jpg",
    ]);
    expect(frontmatter.heroImage).toBe("/images/portfolio/gallery-hero.jpg");
    expect(frontmatter.date).toBe("1970-01-01");
    expect(result.relativePath).toBe("portfolio/gallery.md");
  });
});
