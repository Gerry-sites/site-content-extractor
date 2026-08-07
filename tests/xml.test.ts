import { describe, expect, it } from "vitest";
import { XMLParser } from "../src/crawler/xml.js";

describe("XMLParser", () => {
  it("decodes basic entities in loc values", () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://example.com/a&amp;b</loc></url>
      </urlset>`;
    const doc = new XMLParser().parse(xml) as {
      urlset: { url: { loc: string } };
    };
    expect(doc.urlset.url.loc).toBe("https://example.com/a&b");
  });

  it("returns an empty object for non-xml input", () => {
    expect(new XMLParser().parse("not xml at all")).toEqual({});
  });

  it("ignores XML comments", () => {
    const xml = `<?xml version="1.0"?>
      <!-- comment -->
      <urlset>
        <url><loc>https://example.com/</loc></url>
      </urlset>`;
    const doc = new XMLParser().parse(xml) as {
      urlset: { url: { loc: string } };
    };
    expect(doc.urlset.url.loc).toBe("https://example.com/");
  });
});
