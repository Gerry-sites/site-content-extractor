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
    expect(frontmatter.date).toBeUndefined();
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

  it("strips skippable Wix chrome images from the body", () => {
    const chrome =
      "https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png/v1/fill/w_18,h_18,al_c,q_85/ce6ec7c11b174c0581e20f42bb865ce3.png";
    const page: ExtractedPage = {
      url: "https://studio.example.com/about",
      title: "About",
      description: "Bio",
      slug: "about",
      headings: [],
      htmlContent: `<p>Hi</p><img src="${chrome}" alt="fb" />`,
      images: [],
      links: [],
      videos: [],
      files: [],
      galleries: [],
      isBlogPost: false,
      kind: "page",
    };
    const result = generateMarkdown(page, new Map());
    expect(result.content).not.toContain("ce6ec7c11b174c0581e20f42bb865ce3");
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
      "/images/portfolio/gallery-2.jpg",
      "/images/portfolio/gallery-3.jpg",
    ]);
    expect(frontmatter.heroImage).toBe("/images/portfolio/gallery-hero.jpg");
    expect(frontmatter.date).toBe("1970-01-01");
    expect(result.relativePath).toBe("portfolio/gallery.md");
  });

  it("strips WordPress size queries from already-local image paths", () => {
    const page: ExtractedPage = {
      url: "https://blog.example.com/dish",
      title: "Dish",
      description: "A recipe",
      slug: "dish",
      headings: [],
      htmlContent: '<p>Hi</p><img src="/images/blog/dish.jpg?w=768&ssl=1" alt="Dish" />',
      images: [{ src: "/images/blog/dish.jpg?w=768&ssl=1", alt: "Dish", role: "content" }],
      links: [],
      videos: [],
      files: [],
      galleries: [],
      isBlogPost: true,
      kind: "blog",
    };
    const result = generateMarkdown(page, new Map());
    expect(result.content).toContain("/images/blog/dish.jpg");
    expect(result.content).not.toMatch(/\/images\/blog\/dish\.jpg\?/);
    expect(result.content).not.toContain("w=768");
  });

  it("puts leftover gallery images in frontmatter and strips Wix chrome from the body", () => {
    const page: ExtractedPage = {
      url: "https://studio.example.com/printmaking",
      title: "PRINTMAKING | Studio",
      description:
        "PRINTMAKING MOVEMENT I This project on Movement started soon after returning from a trip.",
      slug: "printmaking",
      headings: [],
      htmlContent: `<h1><a href="/">PRINTMAKING</a></h1><h2>2016</h2><p>The Movement project started after a trip.</p><img src="https://cdn.example.com/18.jpg" alt="" />`,
      images: [{ src: "https://cdn.example.com/18.jpg", role: "content" }],
      links: [],
      videos: [],
      files: [],
      galleries: [
        {
          images: ["https://cdn.example.com/hero.jpg", "https://cdn.example.com/1.jpg"],
        },
      ],
      isBlogPost: false,
      kind: "gallery",
      heroImage: "https://cdn.example.com/hero.jpg",
    };
    const result = generateMarkdown(
      page,
      new Map([
        ["https://cdn.example.com/hero.jpg", "/images/portfolio/printmaking-hero.jpg"],
        ["https://cdn.example.com/1.jpg", "/images/portfolio/printmaking-1.jpg"],
        ["https://cdn.example.com/18.jpg", "/images/portfolio/printmaking-18.jpg"],
      ]),
    );
    const { frontmatter, body } = parseFrontmatter(result.content);
    expect(frontmatter.title).toBe("Printmaking");
    expect(frontmatter.heroImage).toBe("/images/portfolio/printmaking-hero.jpg");
    expect(frontmatter.gallery).toEqual([
      "/images/portfolio/printmaking-1.jpg",
      "/images/portfolio/printmaking-18.jpg",
    ]);
    expect(frontmatter.date).toBe("2016-01-01");
    expect(frontmatter.description).toContain("The Movement project started after a trip");
    expect(frontmatter.description).not.toMatch(/^PRINTMAKING/);
    expect(body).toContain("The Movement project started after a trip");
    expect(body).not.toContain("## 2016");
    expect(body).not.toContain("printmaking-18.jpg");
    expect(body).not.toMatch(/^# \[PRINTMAKING\]/m);
  });

  it("emits per-work titles and captions from extracted image metadata", () => {
    const page: ExtractedPage = {
      url: "https://studio.example.com/after-the-flood",
      title: "After the Flood",
      description: "Series",
      slug: "after-the-flood",
      headings: [],
      htmlContent: "<p>Series notes.</p>",
      images: [
        {
          src: "https://cdn.example.com/hero.jpg",
          role: "gallery",
          title: "After The Flood",
          caption: "Oil on canvas, 100 cm x 70 cm. A symbolic work.",
        },
        {
          src: "https://cdn.example.com/sketch.jpg",
          role: "gallery",
          title: "After The Flood sketch",
        },
      ],
      links: [],
      videos: [],
      files: [],
      galleries: [
        {
          images: ["https://cdn.example.com/hero.jpg", "https://cdn.example.com/sketch.jpg"],
        },
      ],
      isBlogPost: false,
      kind: "gallery",
      heroImage: "https://cdn.example.com/hero.jpg",
    };
    const result = generateMarkdown(
      page,
      new Map([
        ["https://cdn.example.com/hero.jpg", "/images/portfolio/after-the-flood-hero.jpg"],
        ["https://cdn.example.com/sketch.jpg", "/images/portfolio/after-the-flood-1.jpg"],
      ]),
    );
    const { frontmatter } = parseFrontmatter(result.content);
    expect(frontmatter.heroImage).toBe("/images/portfolio/after-the-flood-hero.jpg");
    expect(frontmatter.heroTitle).toBe("After The Flood");
    expect(frontmatter.heroCaption).toContain("Oil on canvas, 100 cm x 70 cm");
    expect(frontmatter.gallery).toEqual([
      {
        src: "/images/portfolio/after-the-flood-1.jpg",
        title: "After The Flood sketch",
      },
    ]);
    expect(result.content).toContain("Oil on canvas, 100 cm x 70 cm");
  });
});
