import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importPacks } from "../src/import/astro.js";
import { exists } from "../src/utils/fs.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function write(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

describe("Astro import", () => {
  it("adds galleries, skips protected about, and omits flagged images", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");

    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(target, "src/content/pages/en/about.md"),
      "---\ntitle: Keep me\ndescription: Existing about\n---\n\nOriginal about.\n",
    );

    await write(
      path.join(pack, "pages/about.md"),
      "---\ntitle: Replacement\ndescription: Should not land\nslug: about\ndate: 2020-01-01\n---\n\nNew about.\n",
    );
    await write(
      path.join(pack, "portfolio/coast.md"),
      "---\ntitle: Coast\ndescription: Sea works\nslug: coast\ndate: 2018-04-01\nheroImage: /images/portfolio/coast-hero.jpg\ngallery:\n  - /images/portfolio/coast-hero.jpg\n  - /images/portfolio/coast-2.jpg\n---\n\nGallery body.\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/coast-hero.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/coast-2.jpg"), PNG);

    await write(
      path.join(pack, "image-review.json"),
      JSON.stringify([
        {
          remoteUrl: "https://static.wixstatic.com/media/ok.jpg",
          pageUrl: "https://studio.example.com/coast",
          sitePath: "/images/portfolio/coast-hero.jpg",
          flags: [],
        },
        {
          remoteUrl: "https://cdn.other.example/x.jpg",
          pageUrl: "https://studio.example.com/coast",
          sitePath: "/images/portfolio/coast-2.jpg",
          flags: ["other-host"],
        },
      ]),
    );

    const summary = await importPacks({
      packs: [pack],
      target,
      locale: "en",
      protectedPages: ["home", "about", "contact"],
      overwritePages: false,
      overwriteEntries: false,
      includeFlagged: false,
      flagInlineBlog: true,
    });

    const about = await readFile(path.join(target, "src/content/pages/en/about.md"), "utf8");
    expect(about).toContain("Original about");
    expect(about).not.toContain("New about");
    expect(summary.skippedProtected).toContain("pages/about");
    expect(summary.added).toContain("portfolio/coast");

    expect(await exists(path.join(target, "src/content/portfolio/en/coast.md"))).toBe(true);
    expect(await exists(path.join(target, "public/images/portfolio/coast-hero.jpg"))).toBe(true);
    expect(await exists(path.join(target, "public/images/portfolio/coast-2.jpg"))).toBe(false);

    const imported = await readFile(path.join(target, "src/content/portfolio/en/coast.md"), "utf8");
    expect(imported).toContain("/images/portfolio/coast-hero.jpg");
    expect(imported).not.toContain("sourceUrl");
  });

  it("fails when the target is not an Astro content tree", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-bad-"));
    await expect(
      importPacks({
        packs: [root],
        target: root,
        locale: "en",
        protectedPages: ["about"],
        overwritePages: false,
        overwriteEntries: false,
        includeFlagged: false,
        flagInlineBlog: true,
      }),
    ).rejects.toThrow(/src\/content\/config\.ts/);
  });
});
