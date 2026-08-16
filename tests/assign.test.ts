import { mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assignSiteImagePaths } from "../src/pack/assign.js";
import type { ExtractedPage } from "../src/types/schemas.js";
import type { DownloadedImage } from "../src/download/images.js";
import { exists } from "../src/utils/fs.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function galleryPage(url: string, slug: string, remotes: string[]): ExtractedPage {
  return {
    url,
    title: slug,
    slug,
    headings: [],
    htmlContent: "<div></div>",
    images: remotes.map((src) => ({ src, role: "gallery" })),
    links: [],
    videos: [],
    files: [],
    galleries: [{ images: remotes }],
    isBlogPost: false,
    kind: "gallery",
    heroImage: remotes[0],
  };
}

describe("assignSiteImagePaths", () => {
  it("gives each page its own site path even when two pages share a remote URL", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-assign-"));
    const source = path.join(root, "shared.jpg");
    await mkdir(root, { recursive: true });
    await writeFile(source, PNG);

    const remote = "https://static.wixstatic.com/media/shared.jpg";
    const downloaded: DownloadedImage = {
      remoteUrl: remote,
      localPath: source,
      relativePath: "images/_raw/shared.jpg",
      hash: "abc",
      bytes: PNG.length,
    };
    const byRemoteUrl = new Map([[remote, downloaded]]);

    const home = galleryPage("https://studio.example.com/", "home", [remote]);
    const landscape = galleryPage("https://studio.example.com/landscape", "landscape", [
      remote,
      "https://static.wixstatic.com/media/other.jpg",
    ]);
    const otherSource = path.join(root, "other.jpg");
    await writeFile(otherSource, PNG);
    byRemoteUrl.set("https://static.wixstatic.com/media/other.jpg", {
      remoteUrl: "https://static.wixstatic.com/media/other.jpg",
      localPath: otherSource,
      relativePath: "images/_raw/other.jpg",
      hash: "def",
      bytes: PNG.length,
    });

    const assigned = await assignSiteImagePaths([home, landscape], byRemoteUrl, root);

    const homePath = assigned.byPageUrl.get(home.url)?.get(remote);
    const landscapePath = assigned.byPageUrl.get(landscape.url)?.get(remote);
    expect(homePath).toBe("/images/portfolio/home-hero.jpg");
    expect(landscapePath).toBe("/images/portfolio/landscape-hero.jpg");
    expect(homePath).not.toBe(landscapePath);

    expect(await exists(path.join(root, "images/portfolio/home-hero.jpg"))).toBe(true);
    expect(await exists(path.join(root, "images/portfolio/landscape-hero.jpg"))).toBe(true);
    const homeBytes = await readFile(path.join(root, "images/portfolio/home-hero.jpg"));
    const landBytes = await readFile(path.join(root, "images/portfolio/landscape-hero.jpg"));
    expect(homeBytes.equals(landBytes)).toBe(true);

    const landscapeOther = assigned.byPageUrl
      .get(landscape.url)
      ?.get("https://static.wixstatic.com/media/other.jpg");
    expect(landscapeOther).toBe("/images/portfolio/landscape-1.jpg");
  });
});
