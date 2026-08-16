import http from "node:http";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { runMigration } from "../src/pipeline/migrate.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function html(body: string): string {
  return `<!DOCTYPE html><html><head><title>Mini</title></head><body>${body}</body></html>`;
}

function startMiniSite(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const url = req.url?.split("?")[0] ?? "/";
    if (url.startsWith("/media/")) {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(PNG);
      return;
    }
    if (url === "/contact") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("nope");
      return;
    }
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        html(
          `<h1>Home</h1>
           <nav>
             <a href="/about">About</a>
             <a href="/works">Works</a>
             <a href="/tag/ignored">Ignored tag</a>
           </nav>`,
        ),
      );
      return;
    }
    if (url === "/about") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html(`<main><h1>About</h1><p>Studio biography lives here for extraction.</p></main>`));
      return;
    }
    if (url === "/works") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        html(`
          <main>
            <h1>Works</h1>
            <div id="gallery">
              <img src="/media/v1/fill/w_290,h_290/one.jpg" data-full="/media/full-one.jpg" alt="One" />
              <img src="/media/v1/fill/w_290,h_290/two.jpg" data-full="/media/full-two.jpg" alt="Two" />
            </div>
            <button type="button" id="more">Show more</button>
          </main>
          <script>
            setTimeout(function () {
              document.querySelectorAll("img[data-full]").forEach(function (img) {
                img.src = img.getAttribute("data-full");
              });
            }, 300);
            document.getElementById("more").addEventListener("click", function () {
              var g = document.getElementById("gallery");
              g.insertAdjacentHTML(
                "beforeend",
                '<img src="/media/full-three.jpg" alt="Three" /><img src="/media/full-four.jpg" alt="Four" />'
              );
            });
          </script>
        `),
      );
      return;
    }
    if (url === "/tag/ignored") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html("<p>Should not be crawled</p>"));
      return;
    }
    res.writeHead(404);
    res.end("missing");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done, reject) => {
            server.close((err) => (err ? reject(err) : done()));
          }),
      });
    });
  });
}

describe("crawler completeness fixture", () => {
  it("captures linked pages and expanded gallery images, and ignores tags and 404 seeds", async () => {
    const { origin, close } = await startMiniSite();
    const output = await mkdtemp(path.join(os.tmpdir(), "site-migrate-complete-"));
    try {
      const result = await runMigration({
        url: `${origin}/`,
        output,
        depth: 3,
        images: true,
        markdown: true,
        verbose: false,
        headless: true,
        resume: false,
        overwrite: true,
        skipImages: false,
        skipBlog: false,
        platform: "generic",
        respectRobots: false,
        concurrency: 1,
        timeoutMs: 20_000,
        settleMs: 800,
        paths: ["/about", "/contact"],
        generateResponsive: false,
        jsonExport: false,
        userAgent: "site-migrate-test",
      });

      const pagesJson = JSON.parse(await readFile(path.join(output, "pages.json"), "utf8")) as {
        pages: Array<{ normalizedUrl: string }>;
      };
      const urls = pagesJson.pages.map((p) => p.normalizedUrl);
      expect(urls.some((u) => u.endsWith("/about"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/works"))).toBe(true);
      expect(urls.some((u) => u.includes("/tag/ignored"))).toBe(false);

      const about = await readFile(path.join(output, "pages/about.md"), "utf8");
      expect(about).toContain("Studio biography");

      const mdFiles = [
        ...(await readdir(path.join(output, "pages")).catch(() => [])).map((n) => `pages/${n}`),
        ...(await readdir(path.join(output, "portfolio")).catch(() => [])).map(
          (n) => `portfolio/${n}`,
        ),
      ];
      const worksFile = mdFiles.find((n) => n.includes("works"));
      expect(worksFile).toBeTruthy();
      const works = await readFile(path.join(output, worksFile!), "utf8");
      expect(works).not.toContain("w_290");
      const localImages = [...new Set(works.match(/\/images\/[^\s)"']+/g) ?? [])];
      expect(localImages.length).toBeGreaterThanOrEqual(4);

      expect(result.report.coverage?.seedMissing.some((s) => s.path === "/contact")).toBe(true);
      expect(result.report.coverage?.missingHtml.some((u) => u.endsWith("/contact"))).toBe(false);
      expect(result.report.coverage?.missingHtml.some((u) => u.endsWith("/about"))).toBe(false);
      expect(result.report.coverage?.missingHtml.some((u) => u.endsWith("/works"))).toBe(false);
    } finally {
      await close();
    }
  }, 90_000);
});
