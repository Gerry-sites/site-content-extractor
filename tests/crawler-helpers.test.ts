import { describe, expect, it } from "vitest";
import { applyCurrentSrc, injectResourceImages, isLoadMoreLabel } from "../src/crawler/hydrate.js";
import { extraSeedUrls, discoveryFeedUrls, isLowValueCrawlUrl } from "../src/crawler/seeds.js";
import { rememberResumePages, recrawlQueue, shouldRecrawl } from "../src/crawler/resume.js";
import { extractUrlsFromFeedXml } from "../src/crawler/feeds.js";
import { discoverWordpressPostUrls } from "../src/crawler/wordpress-rest.js";

describe("hydrate HTML", () => {
  it("rewrites img src to currentSrc", () => {
    const html = `<img src="/thumb.jpg" alt="Work"></body>`;
    const next = applyCurrentSrc(html, [
      { src: "/thumb.jpg", currentSrc: "https://static.wixstatic.com/media/full.jpg" },
    ]);
    expect(next).toContain("https://static.wixstatic.com/media/full.jpg");
    expect(next).not.toContain('src="/thumb.jpg"');
  });

  it("injects resource URLs that are not already in HTML", () => {
    const html = `<html><body><p>Hi</p></body></html>`;
    const next = injectResourceImages(html, ["https://static.wixstatic.com/media/extra.jpg"]);
    expect(next).toContain("https://static.wixstatic.com/media/extra.jpg");
  });

  it("recognizes load-more labels", () => {
    expect(isLoadMoreLabel("Load more")).toBe(true);
    expect(isLoadMoreLabel("Show More")).toBe(true);
    expect(isLoadMoreLabel("Subscribe")).toBe(false);
  });
});

describe("seed URLs", () => {
  it("builds extra seeds from the origin, not a hardcoded host", () => {
    const urls = extraSeedUrls("https://studio.example.com/", ["/about", "/contact", "cv"]);
    expect(urls).toContain("https://studio.example.com/about");
    expect(urls).toContain("https://studio.example.com/contact");
    expect(urls.some((url) => url.endsWith("/cv"))).toBe(true);
  });

  it("skips WordPress tag/category/author archives", () => {
    expect(isLowValueCrawlUrl("https://blog.example.com/tag/dinner")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/category/recipes")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/author/editor")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/2020/01/hello-post")).toBe(false);
    expect(isLowValueCrawlUrl("https://blog.example.com/about")).toBe(false);
    expect(isLowValueCrawlUrl("https://blog.example.com/2014/11")).toBe(true);
    expect(
      isLowValueCrawlUrl("https://blog.example.com/2015/12/30/about-albi-museum/www-albi-03"),
    ).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/2015/12/30/about-albi-museum")).toBe(false);
    expect(isLowValueCrawlUrl("https://blog.example.com/wp-content/uploads/2020/01/dish.jpg")).toBe(
      true,
    );
    expect(isLowValueCrawlUrl("https://blog.example.com/?pushpress=hub")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/?attachment_id=99")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/photo/attachment/photo-file")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/osd.xml")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/feed.json")).toBe(true);
    expect(isLowValueCrawlUrl("https://blog.example.com/favicon.ico")).toBe(true);
  });

  it("lists feed discovery URLs on the seed origin", () => {
    const feeds = discoveryFeedUrls("https://blog.example.com/posts");
    expect(feeds.every((url) => url.startsWith("https://blog.example.com"))).toBe(true);
    expect(feeds.some((url) => url.endsWith("/feed"))).toBe(true);
  });
});

describe("resume discovery", () => {
  it("keeps cached URLs including low-value ones and HTML-only keys", () => {
    const discovered = new Map();
    rememberResumePages(
      discovered,
      [
        {
          url: "https://studio.example.com/",
          normalizedUrl: "https://studio.example.com",
          depth: 0,
          source: "seed",
        },
        {
          url: "https://studio.example.com/osd.xml",
          normalizedUrl: "https://studio.example.com/osd.xml",
          depth: 1,
          source: "link",
        },
        {
          url: "https://studio.example.com/works",
          normalizedUrl: "https://studio.example.com/works",
          depth: 1,
          source: "link",
        },
      ],
      [
        "https://studio.example.com",
        "https://studio.example.com/works",
        "https://studio.example.com/portraits",
      ],
    );

    expect(discovered.size).toBe(4);
    expect(discovered.has("https://studio.example.com/osd.xml")).toBe(true);
    expect(discovered.has("https://studio.example.com/portraits")).toBe(true);

    const htmlByUrl = new Map([
      ["https://studio.example.com", "<p>home</p>"],
      ["https://studio.example.com/works", "<p>works</p>"],
      ["https://studio.example.com/portraits", "<p>portraits</p>"],
    ]);
    expect(shouldRecrawl("https://studio.example.com/osd.xml", htmlByUrl)).toBe(false);
    expect(shouldRecrawl("https://studio.example.com/works", htmlByUrl)).toBe(false);
    expect(recrawlQueue(discovered, htmlByUrl)).toEqual([]);
  });

  it("does not recrawl URLs that already returned HTTP 404", () => {
    const discovered = new Map();
    rememberResumePages(
      discovered,
      [
        {
          url: "https://studio.example.com/works",
          normalizedUrl: "https://studio.example.com/works",
          depth: 1,
          source: "link",
        },
        {
          url: "https://studio.example.com/contact",
          normalizedUrl: "https://studio.example.com/contact",
          depth: 1,
          source: "seed",
          status: 404,
        },
      ],
      ["https://studio.example.com/works"],
    );
    const htmlByUrl = new Map([["https://studio.example.com/works", "<p>works</p>"]]);
    expect(shouldRecrawl("https://studio.example.com/contact", htmlByUrl, 404)).toBe(false);
    expect(recrawlQueue(discovered, htmlByUrl)).toEqual([]);
  });

  it("queues only URLs that still have no cached HTML", () => {
    const discovered = new Map();
    rememberResumePages(
      discovered,
      [
        {
          url: "https://studio.example.com/works",
          normalizedUrl: "https://studio.example.com/works",
          depth: 1,
          source: "link",
        },
        {
          url: "https://studio.example.com/about",
          normalizedUrl: "https://studio.example.com/about",
          depth: 1,
          source: "seed",
        },
      ],
      ["https://studio.example.com/works"],
    );
    const htmlByUrl = new Map([["https://studio.example.com/works", "<p>works</p>"]]);
    const queue = recrawlQueue(discovered, htmlByUrl);
    expect(queue.map((item) => item.url)).toEqual(["https://studio.example.com/about"]);
  });
});

describe("feeds", () => {
  it("extracts internal item links from RSS XML", () => {
    const xml = `
      <rss><channel>
        <item><link>https://blog.example.com/2020/01/hello/</link></item>
        <item><link>https://other.example/nope</link></item>
      </channel></rss>
    `;
    const urls = extractUrlsFromFeedXml(xml, "https://blog.example.com/");
    expect(urls).toContain("https://blog.example.com/2020/01/hello");
    expect(urls.some((url) => url.includes("other.example"))).toBe(false);
  });
});

describe("WordPress REST discovery", () => {
  it("paginates wp/v2 using the seed origin", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      expect(url.startsWith("https://blog.example.com/")).toBe(true);
      return new Response(JSON.stringify([{ link: "https://blog.example.com/hello-post/" }]), {
        status: 200,
        headers: { "content-type": "application/json", "X-WP-TotalPages": "1" },
      });
    }) as typeof fetch;

    const urls = await discoverWordpressPostUrls(
      "https://blog.example.com/",
      "test-agent",
      fetchImpl,
    );
    expect(urls).toContain("https://blog.example.com/hello-post");
    expect(calls.some((url) => url.includes("/wp-json/wp/v2/posts"))).toBe(true);
    expect(calls.some((url) => url.includes("/wp-json/wp/v2/pages"))).toBe(true);
  });

  it("does not call wordpress.com for loopback hosts", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("no", { status: 404 });
    }) as typeof fetch;

    await discoverWordpressPostUrls("http://127.0.0.1:9/", "test-agent", fetchImpl);
    expect(calls.every((url) => !url.includes("wordpress.com"))).toBe(true);
    expect(calls.some((url) => url.includes("/wp-json/wp/v2/pages"))).toBe(true);
  });
});
