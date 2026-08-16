import { describe, expect, it } from "vitest";
import { XMLParser } from "../src/crawler/xml.js";
import { fetchSitemapUrls } from "../src/crawler/sitemap.js";

describe("sitemap XML parser", () => {
  it("parses urlset documents", () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
      </urlset>`;
    const doc = new XMLParser().parse(xml) as {
      urlset: { url: Array<{ loc: string }> };
    };
    expect(doc.urlset.url).toHaveLength(2);
    expect(doc.urlset.url[0]?.loc).toBe("https://example.com/");
  });

  it("fetches nested sitemap indexes", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("sitemap.xml")) {
        return new Response(
          `<sitemapindex>
             <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
           </sitemapindex>`,
          { status: 200 },
        );
      }
      return new Response(
        `<urlset>
           <url><loc>https://example.com/a</loc></url>
           <url><loc>https://example.com/b</loc></url>
         </urlset>`,
        { status: 200 },
      );
    }) as typeof fetch;

    const urls = await fetchSitemapUrls("https://example.com/sitemap.xml", "test-agent", fetchImpl);
    expect(urls).toEqual(["https://example.com/a", "https://example.com/b"]);
  });
});
