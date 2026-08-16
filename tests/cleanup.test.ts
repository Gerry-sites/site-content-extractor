import { describe, expect, it } from "vitest";
import {
  cleanMarkdownBody,
  firstProseParagraph,
  galleryWithoutHero,
  isSocialOrMailHref,
  looksLikeChromeDescription,
  looksLikeGluedDescription,
  polishDescription,
  polishTitle,
  stripTitleSuffix,
  yearFromHeadings,
} from "../src/markdown/cleanup.js";

describe("markdown cleanup helpers", () => {
  it("strips a site-name suffix without emptying the title", () => {
    expect(stripTitleSuffix("CAVE | Studio")).toBe("CAVE");
    expect(stripTitleSuffix(" | Studio")).toBe(" | Studio");
    expect(polishTitle("CAVE | Studio")).toBe("Cave");
    expect(polishTitle("PEN & INK")).toBe("Pen & Ink");
    expect(polishTitle("About Us")).toBe("About Us");
    expect(polishTitle("1993")).toBe("1993");
  });

  it("treats Wix gallery chrome as a description, not real copy", () => {
    expect(looksLikeChromeDescription("PAINTING1/1")).toBe(true);
    expect(looksLikeChromeDescription("PRINTMAKING  MOVEMENT I")).toBe(true);
    expect(looksLikeChromeDescription("1 / 1")).toBe(true);
    expect(looksLikeChromeDescription("PEN & INK")).toBe(true);
    expect(looksLikeChromeDescription("Who we are")).toBe(false);
    expect(looksLikeChromeDescription("Works")).toBe(false);
    expect(looksLikeChromeDescription("The Movement project started after a trip.")).toBe(false);
  });

  it("replaces glued Wix meta descriptions with the first real paragraph", () => {
    expect(
      looksLikeGluedDescription(
        "DRAWINGCAVE 2018 This project began with the observation over the past several years.",
      ),
    ).toBe(true);
    expect(looksLikeGluedDescription("Jeff StudioDRAWINGTURVY AUTOPSY 2016")).toBe(true);
    expect(looksLikeGluedDescription("Who we are")).toBe(false);
    const body = "## 2018\n\nThis project began with the observation over several years of tribalism.\n";
    expect(
      polishDescription(
        "DRAWINGCAVE 2018 This project began with the observation over the past several years.",
        body,
        "Cave",
      ),
    ).toContain("This project began with the observation");
  });

  it("reads a year heading and drops parent-nav chrome from the body", () => {
    const body = "# [Painting](/others)\n\n## 2018\n\nCave drawings from that year.\n";
    const cleaned = cleanMarkdownBody(body, "CAVE");
    expect(cleaned).toBe("## 2018\n\nCave drawings from that year.");
    const sentenceHeading = cleanMarkdownBody(
      "## Work made specifically for the Noces de Cana exhibition, Chapelle Paraire, Rodez, France.\n",
    );
    expect(sentenceHeading).not.toMatch(/^## /);
    expect(sentenceHeading).toContain("Work made specifically");
    expect(firstProseParagraph("![Untitled](/images/pages/hero.jpg)")).toBeUndefined();
    expect(yearFromHeadings(cleaned)).toBe("2018-01-01");
    expect(firstProseParagraph(cleaned)).toContain("Cave drawings");
  });

  it("keeps the hero out of the gallery list", () => {
    expect(
      galleryWithoutHero("/images/portfolio/cave-hero.jpg", [
        ["/images/portfolio/cave-hero.jpg", "/images/portfolio/cave-1.jpg"],
        ["/images/portfolio/cave-1.jpg", "/images/portfolio/cave-2.jpg"],
      ]),
    ).toEqual(["/images/portfolio/cave-1.jpg", "/images/portfolio/cave-2.jpg"]);
  });

  it("ignores social and mailto hrefs", () => {
    expect(isSocialOrMailHref("https://www.facebook.com/studio")).toBe(true);
    expect(isSocialOrMailHref("mailto:hi@example.com")).toBe(true);
    expect(isSocialOrMailHref("/landscape")).toBe(false);
  });
});
