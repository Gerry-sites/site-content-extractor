import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadHtmlCache, saveHtmlPage, writeHtmlIndex } from "../src/crawler/html-cache.js";

describe("HTML cache", () => {
  it("stores hydrated HTML so resume can skip URLs that already have a snapshot", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-html-"));
    const index = {};
    await saveHtmlPage(dir, "https://studio.example.com/about", "<html>about</html>", index);
    await saveHtmlPage(dir, "https://studio.example.com/works", "<html>works</html>", index);
    await writeHtmlIndex(dir, index);

    const loaded = await loadHtmlCache(dir);
    expect(loaded.htmlByUrl.get("https://studio.example.com/about")).toContain("about");
    expect(loaded.htmlByUrl.get("https://studio.example.com/works")).toContain("works");
    expect(loaded.htmlByUrl.has("https://studio.example.com/contact")).toBe(false);
  });
});
