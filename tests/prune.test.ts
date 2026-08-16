import { mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { decideEntry, platformFamily, prunePack, stripMediaQuery } from "../src/pack/prune.js";
import { exists } from "../src/utils/fs.js";

describe("prune heuristics", () => {
  it("maps report platform names to families", () => {
    expect(platformFamily("Wix")).toBe("wix");
    expect(platformFamily("WordPress")).toBe("wordpress");
    expect(platformFamily("Generic HTML")).toBe("generic");
  });

  it("strips leftover size queries from local image paths", () => {
    expect(stripMediaQuery("/images/blog/dish.jpg?w=768&ssl=1")).toBe("/images/blog/dish.jpg");
  });

  it("drops Wix drafts, placeholders, hubs, and protected pages", () => {
    const siblings = new Set(["amphorae", "copy-of-about", "painting", "home"]);
    const draft = decideEntry(
      {
        folder: "pages",
        slug: "copy-of-about",
        title: "Copy of ABOUT",
        description: "x",
        body: "Hello",
        frontmatter: {},
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(draft.keep).toBe(false);
    expect(draft.reason).toBe("draft-slug");

    const placeholder = decideEntry(
      {
        folder: "pages",
        slug: "manufacturing",
        title: "Manufacturing",
        description: "I'm a paragraph. Click here to add your own text and edit me.",
        body: "Short",
        frontmatter: {},
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(placeholder.keep).toBe(false);
    expect(placeholder.reason).toBe("wix-placeholder");

    const hub = decideEntry(
      {
        folder: "portfolio",
        slug: "painting",
        title: "Painting",
        description: "Hub",
        body: "[a](/portraits)\n[b](/uw)\n[c](/mass)\n[d](/cave)\n",
        frontmatter: {},
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(hub.keep).toBe(false);
    expect(hub.reason).toBe("hub-index");

    const home = decideEntry(
      {
        folder: "portfolio",
        slug: "home",
        title: "HOME",
        description: "1/1",
        body: "[](/portraits)",
        frontmatter: { gallery: ["/images/portfolio/home-1.jpg"] },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(home.keep).toBe(false);
    expect(home.reason).toBe("protected-page");

    const work = decideEntry(
      {
        folder: "pages",
        slug: "amphorae",
        title: "Amphorae",
        description: "Jars for Cana",
        body: "The wedding at Cana has been portrayed in paintings for centuries.\n\n![](/images/pages/amphorae-hero.jpg)\n",
        frontmatter: { heroImage: "/images/pages/amphorae-hero.jpg" },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(work.keep).toBe(true);
    expect(work.folder).toBe("portfolio");

    const grid = decideEntry(
      {
        folder: "portfolio",
        slug: "drawing",
        title: "Drawing",
        description: "Works on paper",
        body: "[a](/one)\n[b](/two)\n[c](/three)\n[d](/four)\n",
        frontmatter: {
          gallery: [
            "/images/portfolio/drawing-1.jpg",
            "/images/portfolio/drawing-2.jpg",
            "/images/portfolio/drawing-3.jpg",
          ],
        },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(grid.keep).toBe(false);
    expect(grid.reason).toBe("hub-index");

    const series = decideEntry(
      {
        folder: "portfolio",
        slug: "landscape",
        title: "Landscape",
        description: "Landscapes",
        body: "# [Painting](/others)\n\n## Landscape\n",
        frontmatter: {
          gallery: [
            "/images/portfolio/landscape-hero.jpg",
            "/images/portfolio/landscape-1.jpg",
            "/images/portfolio/landscape-2.jpg",
          ],
        },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(series.keep).toBe(true);
    expect(series.folder).toBe("portfolio");

    const thin = decideEntry(
      {
        folder: "pages",
        slug: "turvy-autopsy",
        title: "TURVY AUTOPSY",
        description: "Jeff StudioDRAWINGTURVY AUTOPSY 2016",
        body: "- [](http://www.facebook.com/studio)\n- [](https://instagram.com/studio/)\n\n## 2016\n\n![Untitled](/images/pages/turvy-autopsy-hero.jpg)\n",
        frontmatter: { heroImage: "/images/pages/turvy-autopsy-hero.jpg" },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(thin.keep).toBe(false);
    expect(thin.reason).toBe("thin-chrome");

    const photo = decideEntry(
      {
        folder: "pages",
        slug: "suitcase",
        title: "Suitcase",
        description: "SUITCASE2002",
        body: "# 2002\n\n# /barite paper; no digital manipulation/\n\n![](/images/portfolio/suitcase.jpg)\n",
        frontmatter: { heroImage: "/images/portfolio/suitcase.jpg" },
        siblingSlugs: new Set(["suitcase"]),
      },
      "wix",
    );
    expect(photo.keep).toBe(true);
    expect(photo.folder).toBe("portfolio");

    const counter = decideEntry(
      {
        folder: "portfolio",
        slug: "oldpaint",
        title: "Oldpaint",
        description: "PAINTING1/1",
        body: "Tiles",
        frontmatter: { gallery: ["/images/portfolio/oldpaint-1.jpg"] },
        siblingSlugs: siblings,
      },
      "wix",
    );
    expect(counter.keep).toBe(false);
    expect(counter.reason).toBe("wix-gallery-chrome");
  });

  it("drops WordPress category indexes but keeps real posts", () => {
    const siblings = new Set(["recipes", "about-albi-museum"]);
    const index = decideEntry(
      {
        folder: "blog",
        slug: "recipes",
        title: "Recipes",
        description: "All recipes",
        body: Array.from({ length: 50 }, (_, i) => `[p${i}](/post-${i})`).join("\n"),
        frontmatter: {},
        siblingSlugs: siblings,
      },
      "wordpress",
    );
    expect(index.keep).toBe(false);
    expect(index.reason).toBe("hub-index");

    const post = decideEntry(
      {
        folder: "blog",
        slug: "about-albi-museum",
        title: "About Albi",
        description: "Museum visit",
        body: `${"Albi is a brick city on the Tarn. ".repeat(40)}\n\n![](/images/blog/albi-hero.jpg)\n`,
        frontmatter: { heroImage: "/images/blog/albi-hero.jpg" },
        siblingSlugs: siblings,
      },
      "wordpress",
    );
    expect(post.keep).toBe(true);
    expect(post.folder).toBe("blog");

    const galleryHub = decideEntry(
      {
        folder: "blog",
        slug: "turvy-autopsy",
        title: "Turvy",
        description: "Series",
        body: Array.from({ length: 40 }, (_, i) => `[p${i}](/post-${i})`).join("\n"),
        frontmatter: {
          gallery: [
            "/images/blog/turvy-1.jpg",
            "/images/blog/turvy-2.jpg",
            "/images/blog/turvy-3.jpg",
          ],
        },
        siblingSlugs: siblings,
      },
      "wordpress",
    );
    expect(galleryHub.keep).toBe(false);
    expect(galleryHub.reason).toBe("hub-index");
  });
});

describe("prunePack", () => {
  it("writes only keepers and skips flagged chrome/other-host images", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-prune-"));
    const pack = path.join(root, "pack");
    const out = path.join(root, "pruned");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    async function write(rel: string, content: string | Buffer) {
      const full = path.join(pack, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }

    await write(
      "report.json",
      JSON.stringify({ platform: "Wix", seedUrl: "https://studio.example.com/" }),
    );
    await write(
      "pages/copy-of-about.md",
      "---\ntitle: Copy of ABOUT\ndescription: Draft\nslug: copy-of-about\n---\n\nI'm a paragraph. Click here to add your own text and edit me.\n",
    );
    await write(
      "pages/amphorae.md",
      "---\ntitle: Amphorae\ndescription: Jars\nslug: amphorae\nheroImage: /images/pages/amphorae-hero.jpg\n---\n\nThe wedding at Cana has been portrayed for centuries.\n\n![](/images/pages/amphorae-hero.jpg)\n![](/images/pages/chrome.png)\n",
    );
    await write("images/pages/amphorae-hero.jpg", png);
    await write("images/pages/chrome.png", png);
    await write(
      "image-review.json",
      JSON.stringify([
        {
          remoteUrl: "https://static.wixstatic.com/media/ok.jpg",
          pageUrl: "https://studio.example.com/amphorae",
          sitePath: "/images/pages/amphorae-hero.jpg",
          flags: [],
        },
        {
          remoteUrl: "https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png",
          pageUrl: "https://studio.example.com/amphorae",
          sitePath: "/images/pages/chrome.png",
          flags: ["chrome"],
        },
      ]),
    );

    const summary = await prunePack(pack, out);
    expect(summary.dropped.some((row) => row.from === "pages/copy-of-about.md")).toBe(true);
    expect(summary.kept.some((row) => row.to === "portfolio/amphorae.md")).toBe(true);
    expect(await exists(path.join(out, "pages/copy-of-about.md"))).toBe(false);
    expect(await exists(path.join(out, "portfolio/amphorae.md"))).toBe(true);
    expect(await exists(path.join(out, "images/pages/amphorae-hero.jpg"))).toBe(true);
    expect(await exists(path.join(out, "images/pages/chrome.png"))).toBe(false);

    const md = await readFile(path.join(out, "portfolio/amphorae.md"), "utf8");
    expect(md).toContain("wedding at Cana");
    expect(md).not.toContain("Copy of");
  });

  it("drops WordPress recipe indexes and numbered duplicates from a pack", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-prune-wp-"));
    const pack = path.join(root, "pack");
    const out = path.join(root, "pruned");

    async function write(rel: string, content: string) {
      const full = path.join(pack, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }

    await write("report.json", JSON.stringify({ platform: "WordPress" }));
    const links = Array.from({ length: 45 }, (_, i) => `[r${i}](/recipes/r${i})`).join("\n");
    await write(
      "blog/recipes.md",
      `---\ntitle: Recipes\ndescription: Index\nslug: recipes\n---\n\n${links}\n`,
    );
    await write(
      "blog/albi.md",
      "---\ntitle: Albi\ndescription: Trip\nslug: albi\nheroImage: /images/blog/albi.jpg\n---\n\nA long visit to the brick city and the museum by the river.\n\n![Albi](/images/blog/albi.jpg?w=401&ssl=1)\n",
    );
    await write(
      "blog/albi-2.md",
      "---\ntitle: Albi\ndescription: Trip copy\nslug: albi-2\n---\n\nDuplicate numbered WordPress slug.\n",
    );

    const summary = await prunePack(pack, out);
    expect(
      summary.dropped.some((row) => row.from === "blog/recipes.md" && row.reason === "hub-index"),
    ).toBe(true);
    expect(summary.dropped.some((row) => row.from === "blog/albi-2.md")).toBe(true);
    expect(await exists(path.join(out, "blog/albi.md"))).toBe(true);
    expect(await exists(path.join(out, "blog/recipes.md"))).toBe(false);
    const md = await readFile(path.join(out, "blog/albi.md"), "utf8");
    expect(md).toContain("/images/blog/albi.jpg");
    expect(md).not.toContain("?w=401");
  });

  it("cleans Wix chrome on keepers and still drops gallery hubs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-prune-chrome-"));
    const pack = path.join(root, "pack");
    const out = path.join(root, "pruned");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    async function write(rel: string, content: string | Buffer) {
      const full = path.join(pack, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }

    await write("report.json", JSON.stringify({ platform: "Wix" }));
    await write(
      "portfolio/cave.md",
      "---\ntitle: CAVE | Studio\ndescription: CAVE DRAWINGS\nslug: cave\ndate: 1970-01-01\nheroImage: /images/portfolio/cave-hero.jpg\ngallery:\n  - /images/portfolio/cave-hero.jpg\n  - /images/portfolio/cave-1.jpg\n---\n\n# [Painting](/others)\n\n## 2018\n\nCave drawings from that year.\n\n![](/images/portfolio/cave-2.jpg)\n",
    );
    await write(
      "portfolio/drawing.md",
      "---\ntitle: Drawing\ndescription: Works on paper\nslug: drawing\nheroImage: /images/portfolio/drawing-hero.jpg\ngallery:\n  - /images/portfolio/drawing-1.jpg\n  - /images/portfolio/drawing-2.jpg\n  - /images/portfolio/drawing-3.jpg\n---\n\n[a](/one)\n[b](/two)\n[c](/three)\n[d](/four)\n",
    );
    await write("images/portfolio/cave-hero.jpg", png);
    await write("images/portfolio/cave-1.jpg", png);
    await write("images/portfolio/cave-2.jpg", png);

    const summary = await prunePack(pack, out);
    expect(summary.dropped.some((row) => row.from === "portfolio/drawing.md")).toBe(true);
    expect(await exists(path.join(out, "portfolio/drawing.md"))).toBe(false);
    expect(await exists(path.join(out, "portfolio/cave.md"))).toBe(true);
    expect(await exists(path.join(out, "images/portfolio/cave-2.jpg"))).toBe(true);

    const md = await readFile(path.join(out, "portfolio/cave.md"), "utf8");
    expect(md).toContain("title: Cave");
    expect(md).not.toContain(" | Studio");
    expect(md).not.toContain("CAVE DRAWINGS");
    expect(md).toMatch(/date: ['"]?2018-01-01['"]?/);
    expect(md).toContain("Cave drawings from that year");
    expect(md).not.toContain("## 2018");
    expect(md).not.toContain("[Painting](/others)");
    expect(md).toContain("/images/portfolio/cave-2.jpg");
    expect(md).not.toMatch(/gallery:[\s\S]*cave-hero\.jpg/);
    expect(md).not.toContain("![](/images/portfolio/cave-2.jpg)");
  });

  it("drops a hero-only Wix chrome page", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-prune-thin-"));
    const pack = path.join(root, "pack");
    const out = path.join(root, "pruned");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    async function write(rel: string, content: string | Buffer) {
      const full = path.join(pack, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content);
    }

    await write("report.json", JSON.stringify({ platform: "Wix" }));
    await write(
      "pages/turvy-autopsy.md",
      "---\ntitle: TURVY AUTOPSY | Studio\ndescription: Jeff StudioDRAWINGTURVY AUTOPSY 2016\nslug: turvy-autopsy\nheroImage: /images/pages/turvy-autopsy-hero.jpg\n---\n\n- [](http://www.facebook.com/studio)\n\n## 2016\n\n![Untitled](/images/pages/turvy-autopsy-hero.jpg)\n",
    );
    await write("images/pages/turvy-autopsy-hero.jpg", png);

    const summary = await prunePack(pack, out);
    expect(
      summary.dropped.some(
        (row) => row.from === "pages/turvy-autopsy.md" && row.reason === "thin-chrome",
      ),
    ).toBe(true);
    expect(await exists(path.join(out, "portfolio/turvy-autopsy.md"))).toBe(false);
  });
});
