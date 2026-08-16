import { describe, expect, it } from "vitest";
import {
  buildFrontmatter,
  parseFrontmatter,
  serializeMarkdownFile,
} from "../src/markdown/frontmatter.js";

describe("frontmatter", () => {
  it("requires title and slug", () => {
    expect(() => buildFrontmatter({ title: "", slug: "x" })).toThrow();
    expect(() => buildFrontmatter({ title: "X", slug: "" })).toThrow();
  });

  it("round-trips YAML frontmatter", () => {
    const content = serializeMarkdownFile(
      {
        title: "Home",
        description: "Welcome",
        slug: "home",
        heroImage: "images/hero.jpg",
        gallery: ["images/a.jpg", "images/b.jpg"],
      },
      "# Home\n\nHello world.\n",
    );

    expect(content.startsWith("---\n")).toBe(true);
    const { frontmatter, body } = parseFrontmatter(content);
    expect(frontmatter.title).toBe("Home");
    expect(frontmatter.slug).toBe("home");
    expect(frontmatter.heroImage).toBe("images/hero.jpg");
    expect(frontmatter.gallery).toEqual(["images/a.jpg", "images/b.jpg"]);
    expect(body).toContain("# Home");
    expect(body).toContain("Hello world.");
  });

  it("keeps ISO dates as strings instead of YAML timestamps", () => {
    const { frontmatter } = parseFrontmatter(
      "---\ntitle: Coast\nslug: coast\ndate: 1970-01-01\n---\n\nBody.\n",
    );
    expect(frontmatter.date).toBe("1970-01-01");
    expect(typeof frontmatter.date).toBe("string");
  });

  it("returns empty frontmatter when document has none", () => {
    const { frontmatter, body } = parseFrontmatter("# Just content\n");
    expect(frontmatter).toEqual({});
    expect(body).toContain("Just content");
  });
});
