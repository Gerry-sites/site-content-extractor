import { describe, expect, it } from "vitest";
import { loadRobots } from "../src/crawler/robots.js";

describe("robots.txt loader", () => {
  it("parses disallow rules and sitemaps", async () => {
    const fetchImpl = (async () =>
      new Response(
        `User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml\n`,
        { status: 200 },
      )) as typeof fetch;

    const robots = await loadRobots("https://example.com", "site-migrate/0.1", fetchImpl);

    expect(robots.isAllowed("https://example.com/about")).toBe(true);
    expect(robots.isAllowed("https://example.com/private/secret")).toBe(false);
    expect(robots.sitemaps).toContain("https://example.com/sitemap.xml");
  });

  it("allows everything when robots.txt is missing", async () => {
    const fetchImpl = (async () => new Response("missing", { status: 404 })) as typeof fetch;

    const robots = await loadRobots("https://example.com", "site-migrate/0.1", fetchImpl);

    expect(robots.isAllowed("https://example.com/anything")).toBe(true);
    expect(robots.sitemaps[0]).toBe("https://example.com/sitemap.xml");
  });
});
