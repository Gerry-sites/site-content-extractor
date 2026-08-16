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
    expect(imported).not.toMatch(/gallery:[\s\S]*coast-hero\.jpg/);
  });

  it("fills missing images on existing entries without dropping extra frontmatter", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-fill-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");

    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(target, "src/content/portfolio/en/coast.md"),
      "---\ntitle: Coast\ndescription: Kept\ndate: 2018-04-01\nheroImage: /images/portfolio/coast-hero.jpg\ngallery:\n  - /images/portfolio/coast-1.jpg\ncategories:\n  - Painting\nmedium: Oil\nfeatured: true\n---\n\nClone body.\n",
    );

    await write(
      path.join(pack, "portfolio/coast.md"),
      "---\ntitle: COAST | Studio\ndescription: Chrome\nslug: coast\ndate: 1970-01-01\nheroImage: /images/portfolio/coast-hero.jpg\ngallery:\n  - /images/portfolio/coast-hero.jpg\n  - /images/portfolio/coast-1.jpg\n  - /images/portfolio/coast-2.jpg\n---\n\n![](/images/portfolio/coast-3.jpg)\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/coast-hero.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/coast-1.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/coast-2.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/coast-3.jpg"), PNG);

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

    expect(summary.filledImages).toContain("portfolio/coast");
    expect(await exists(path.join(target, "public/images/portfolio/coast-3.jpg"))).toBe(true);

    const filled = await readFile(path.join(target, "src/content/portfolio/en/coast.md"), "utf8");
    expect(filled).toContain("title: Coast");
    expect(filled).toContain("Clone body");
    expect(filled).toContain("medium: Oil");
    expect(filled).toContain("featured: true");
    expect(filled).toContain("2018-04-01");
    expect(filled).toContain("/images/portfolio/coast-2.jpg");
    expect(filled).toContain("/images/portfolio/coast-3.jpg");
    expect(filled).not.toMatch(/gallery:[\s\S]*coast-hero\.jpg/);
  });

  it("strips a site-name suffix from new titles", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-title-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");
    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(pack, "portfolio/cave.md"),
      "---\ntitle: CAVE | Midghall\ndescription: Drawings\nslug: cave\ndate: 2018-01-01\nheroImage: /images/portfolio/cave-hero.jpg\n---\n\nBody.\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/cave-hero.jpg"), PNG);

    await importPacks({
      packs: [pack],
      target,
      locale: "en",
      protectedPages: ["about"],
      overwritePages: false,
      overwriteEntries: false,
      includeFlagged: false,
      flagInlineBlog: true,
    });

    const imported = await readFile(path.join(target, "src/content/portfolio/en/cave.md"), "utf8");
    expect(imported).toContain("title: Cave");
    expect(imported).not.toContain("Midghall");
  });

  it("fills missing work captions on existing entries without replacing the body", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-captions-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");

    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(target, "src/content/portfolio/en/coast.md"),
      "---\ntitle: Coast\ndescription: Kept\ndate: 2018-04-01\nheroImage: /images/portfolio/coast-hero.jpg\ngallery:\n  - /images/portfolio/coast-1.jpg\ncategories:\n  - Painting\nmedium: Oil\n---\n\nClone body.\n",
    );
    await mkdir(path.join(target, "public/images/portfolio"), { recursive: true });
    await writeFile(path.join(target, "public/images/portfolio/coast-hero.jpg"), PNG);
    await writeFile(path.join(target, "public/images/portfolio/coast-1.jpg"), PNG);

    await write(
      path.join(pack, "portfolio/coast.md"),
      "---\ntitle: COAST | Studio\ndescription: Chrome\nslug: coast\ndate: 1970-01-01\nheroImage: /images/portfolio/coast-hero.jpg\nheroTitle: Coast painting\nheroCaption: Oil on canvas, 100 cm x 70 cm. A symbolic work.\ngallery:\n  - src: /images/portfolio/coast-1.jpg\n    title: Coast sketch\n---\n\nPack body.\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/coast-hero.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/coast-1.jpg"), PNG);

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

    expect(summary.filledCaptions).toContain("portfolio/coast");
    expect(summary.filledImages).not.toContain("portfolio/coast");
    expect(summary.skippedExisting).not.toContain("portfolio/coast");

    const filled = await readFile(path.join(target, "src/content/portfolio/en/coast.md"), "utf8");
    expect(filled).toContain("title: Coast");
    expect(filled).toContain("Clone body");
    expect(filled).toContain("medium: Oil");
    expect(filled).toContain("heroCaption: Oil on canvas, 100 cm x 70 cm");
    expect(filled).toContain("title: Coast sketch");
    expect(filled).not.toContain("Pack body");
    expect(filled).not.toContain("COAST | Studio");
  });

  it("replaces a clone image when the pack file for the same src is a different work", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-realign-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");
    const actor = Buffer.from("actor-bytes");
    const father = Buffer.from("father-bytes");

    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(target, "src/content/portfolio/en/portraits.md"),
      "---\ntitle: Portraits\ndescription: Kept\ndate: 2019-01-01\nheroImage: /images/portfolio/portraits-hero.jpg\ngallery:\n  - src: /images/portfolio/portraits-1.jpg\n    title: My Father\ncategories:\n  - Painting\n---\n\nClone body.\n",
    );
    await mkdir(path.join(target, "public/images/portfolio"), { recursive: true });
    await writeFile(path.join(target, "public/images/portfolio/portraits-hero.jpg"), PNG);
    await writeFile(path.join(target, "public/images/portfolio/portraits-1.jpg"), actor);

    await write(
      path.join(pack, "portfolio/portraits.md"),
      "---\ntitle: Portraits\ndescription: Pack\nslug: portraits\ndate: 1970-01-01\nheroImage: /images/portfolio/portraits-hero.jpg\ngallery:\n  - src: /images/portfolio/portraits-1.jpg\n    title: My Father\n---\n\nPack body.\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/portraits-hero.jpg"), PNG);
    await writeFile(path.join(pack, "images/portfolio/portraits-1.jpg"), father);

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

    expect(summary.filledImages).toContain("portfolio/portraits");
    expect(summary.skippedExisting).not.toContain("portfolio/portraits");
    const dest = await readFile(path.join(target, "public/images/portfolio/portraits-1.jpg"));
    expect(dest.equals(father)).toBe(true);
    const filled = await readFile(
      path.join(target, "src/content/portfolio/en/portraits.md"),
      "utf8",
    );
    expect(filled).toContain("Clone body");
    expect(filled).toContain("title: My Father");
  });

  it("does not import a protected slug from portfolio", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-home-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");
    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(pack, "portfolio/home.md"),
      "---\ntitle: HOME | Studio\ndescription: Hub\nslug: home\ndate: 1970-01-01\nheroImage: /images/portfolio/home-hero.jpg\n---\n\nTiles.\n",
    );
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(path.join(pack, "images/portfolio/home-hero.jpg"), PNG);

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

    expect(summary.skippedProtected).toContain("portfolio/home");
    expect(await exists(path.join(target, "src/content/portfolio/en/home.md"))).toBe(false);
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

  it("copies inline-blog and title-name-in-media images by default", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-import-inline-"));
    const pack = path.join(root, "pack");
    const target = path.join(root, "site");
    await write(path.join(target, "src/content/config.ts"), "export const collections = {}");
    await write(
      path.join(pack, "blog/albi.md"),
      "---\ntitle: About Albi\ndescription: Museum visit\nslug: albi\ndate: 2015-12-30\nheroImage: /images/blog/albi-hero.jpg\n---\n\n![Albi](/images/blog/albi-2.jpg)\n",
    );
    await mkdir(path.join(pack, "images/blog"), { recursive: true });
    await writeFile(path.join(pack, "images/blog/albi-hero.jpg"), PNG);
    await writeFile(path.join(pack, "images/blog/albi-2.jpg"), PNG);
    await write(
      path.join(pack, "image-review.json"),
      JSON.stringify([
        {
          remoteUrl: "https://blog.example.com/wp-content/uploads/albi-hero.jpg",
          pageUrl: "https://blog.example.com/about-albi/",
          sitePath: "/images/blog/albi-hero.jpg",
          flags: [],
        },
        {
          remoteUrl: "https://blog.example.com/wp-content/uploads/albi-2.jpg",
          pageUrl: "https://blog.example.com/about-albi/",
          sitePath: "/images/blog/albi-2.jpg",
          flags: ["inline-blog", "title-name-in-media"],
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
      flagInlineBlog: false,
    });

    expect(summary.added).toContain("blog/albi");
    expect(await exists(path.join(target, "public/images/blog/albi-hero.jpg"))).toBe(true);
    expect(await exists(path.join(target, "public/images/blog/albi-2.jpg"))).toBe(true);
    expect(summary.skippedFlaggedImages).toBe(0);
    const imported = await readFile(path.join(target, "src/content/blog/en/albi.md"), "utf8");
    expect(imported).toContain("/images/blog/albi-2.jpg");
  });
});
