import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assignSiteImagePaths } from "../src/pack/assign.js";
import { stampPageImageIdentity } from "../src/pack/identity.js";
import { generateMarkdown } from "../src/markdown/generate.js";
import { parseFrontmatter } from "../src/markdown/frontmatter.js";
import { platformMediaId } from "../src/media/identity.js";
import { captionsNeedMerge, mergeGalleryCaptions } from "../src/pack/gallery.js";
import { verifyGallery } from "../src/validate/gallery.js";
import { sha256 } from "../src/utils/hash.js";
import type { ExtractedPage } from "../src/types/schemas.js";
import type { DownloadedImage } from "../src/download/images.js";

const ACTOR = Buffer.from("actor-work-bytes");
const FATHER = Buffer.from("father-work-bytes");
const ACTOR_HASH = sha256(ACTOR);
const FATHER_HASH = sha256(FATHER);

function downloaded(remote: string, localPath: string, buffer: Buffer): DownloadedImage {
  return {
    remoteUrl: remote,
    localPath,
    relativePath: `images/_raw/${path.basename(localPath)}`,
    hash: sha256(buffer),
    bytes: buffer.length,
  };
}

describe("platform media ids", () => {
  it("reads a Wix media id from a CDN URL", () => {
    expect(
      platformMediaId(
        "https://static.wixstatic.com/media/bfe860_father~mv2.jpg/v1/fit/w_1800/a.jpg",
      ),
    ).toBe("bfe860_father~mv2.jpg");
  });

  it("reads a WordPress uploads path without size suffixes", () => {
    expect(
      platformMediaId("https://blog.example.com/wp-content/uploads/2020/01/toast-300x200.jpg"),
    ).toBe("2020/01/toast.jpg");
    expect(platformMediaId("https://cdn.example.com/photo.jpg")).toBeUndefined();
  });
});

describe("gallery identity merge", () => {
  it("applies pack captions onto the clone item with the same media id, even when src paths differ", () => {
    expect(
      mergeGalleryCaptions(
        [{ src: "/images/portfolio/portraits-2.jpg", mediaId: "bfe860_father~mv2.jpg" }],
        [
          {
            src: "/images/portfolio/portraits-1.jpg",
            mediaId: "bfe860_father~mv2.jpg",
            hash: FATHER_HASH,
            title: "My Father",
          },
        ],
      ),
    ).toEqual([
      {
        src: "/images/portfolio/portraits-2.jpg",
        title: "My Father",
        mediaId: "bfe860_father~mv2.jpg",
        hash: FATHER_HASH,
      },
    ]);
  });

  it("reports a merge when the clone is missing identity fields", () => {
    expect(
      captionsNeedMerge(
        ["/images/portfolio/portraits-1.jpg"],
        [
          {
            src: "/images/portfolio/portraits-1.jpg",
            mediaId: "bfe860_father~mv2.jpg",
            hash: FATHER_HASH,
            title: "My Father",
          },
        ],
      ),
    ).toBe(true);
  });
});

describe("extract then assign keeps titles on the matching bytes", () => {
  it("writes hero/gallery identity from download hashes, not from DOM slot order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-identity-"));
    const actorFile = path.join(root, "actor.jpg");
    const fatherFile = path.join(root, "father.jpg");
    await writeFile(actorFile, ACTOR);
    await writeFile(fatherFile, FATHER);

    const actorRemote =
      "https://static.wixstatic.com/media/bfe860_actor~mv2.jpg/v1/fit/w_1800/a.jpg";
    const fatherRemote =
      "https://static.wixstatic.com/media/bfe860_father~mv2.jpg/v1/fit/w_1800/b.jpg";
    const byRemoteUrl = new Map([
      [actorRemote, downloaded(actorRemote, actorFile, ACTOR)],
      [fatherRemote, downloaded(fatherRemote, fatherFile, FATHER)],
    ]);

    const page: ExtractedPage = {
      url: "https://studio.example.com/portraits",
      title: "Portraits",
      slug: "portraits",
      headings: [],
      htmlContent: "<div></div>",
      images: [
        {
          src: fatherRemote,
          role: "gallery",
          title: "My Father",
          mediaId: "bfe860_father~mv2.jpg",
        },
        {
          src: actorRemote,
          role: "gallery",
          title: "The Actor",
          mediaId: "bfe860_actor~mv2.jpg",
        },
      ],
      links: [],
      videos: [],
      files: [],
      galleries: [{ images: [fatherRemote, actorRemote] }],
      isBlogPost: false,
      kind: "gallery",
      heroImage: fatherRemote,
    };

    const assigned = await assignSiteImagePaths([page], byRemoteUrl, root);
    stampPageImageIdentity([page], byRemoteUrl);
    const md = generateMarkdown(page, assigned.byPageUrl.get(page.url)!);
    const { frontmatter } = parseFrontmatter(md.content);

    expect(frontmatter.heroImage).toBe("/images/portfolio/portraits-hero.jpg");
    expect(frontmatter.heroTitle).toBe("My Father");
    expect(frontmatter.heroMediaId).toBe("bfe860_father~mv2.jpg");
    expect(frontmatter.heroHash).toBe(FATHER_HASH);
    expect(frontmatter.gallery).toEqual([
      {
        src: "/images/portfolio/portraits-1.jpg",
        title: "The Actor",
        mediaId: "bfe860_actor~mv2.jpg",
        hash: ACTOR_HASH,
      },
    ]);
    expect(await readFile(path.join(root, "images/portfolio/portraits-hero.jpg"))).toEqual(FATHER);
    expect(await readFile(path.join(root, "images/portfolio/portraits-1.jpg"))).toEqual(ACTOR);
  });
});

describe("verify-gallery", () => {
  async function writePack(root: string, yamlHash = FATHER_HASH, bytes = FATHER) {
    const pack = path.join(root, "pack");
    await mkdir(path.join(pack, "portfolio"), { recursive: true });
    await mkdir(path.join(pack, "images/portfolio"), { recursive: true });
    await writeFile(
      path.join(pack, "portfolio/portraits.md"),
      `---
title: Portraits
description: Series
slug: portraits
heroImage: /images/portfolio/portraits-hero.jpg
heroTitle: My Father
heroMediaId: bfe860_father~mv2.jpg
heroHash: ${yamlHash}
gallery:
  - src: /images/portfolio/portraits-1.jpg
    title: The Actor
    mediaId: bfe860_actor~mv2.jpg
    hash: ${ACTOR_HASH}
---

Notes.
`,
    );
    await writeFile(path.join(pack, "images/portfolio/portraits-hero.jpg"), bytes);
    await writeFile(path.join(pack, "images/portfolio/portraits-1.jpg"), ACTOR);
    return pack;
  }

  it("fails when YAML hash does not match the file on disk", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-verify-yaml-"));
    const pack = await writePack(root, FATHER_HASH, ACTOR);
    const result = await verifyGallery({ pack, locale: "en" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.message.includes("YAML hash"))).toBe(true);
  });

  it("fails when the clone file at a path is a different work than the pack", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-verify-clone-"));
    const pack = await writePack(root);
    const target = path.join(root, "site");
    await mkdir(path.join(target, "src/content/portfolio/en"), { recursive: true });
    await mkdir(path.join(target, "public/images/portfolio"), { recursive: true });
    await writeFile(
      path.join(target, "src/content/portfolio/en/portraits.md"),
      `---
title: Portraits
description: Series
heroImage: /images/portfolio/portraits-hero.jpg
heroTitle: My Father
gallery:
  - src: /images/portfolio/portraits-1.jpg
    title: The Actor
---

Clone body.
`,
    );
    await writeFile(path.join(target, "public/images/portfolio/portraits-hero.jpg"), ACTOR);
    await writeFile(path.join(target, "public/images/portfolio/portraits-1.jpg"), ACTOR);

    const result = await verifyGallery({ pack, target, locale: "en" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.message.includes("different work"))).toBe(true);
  });

  it("passes when pack files, YAML hashes, and clone files agree", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "site-migrate-verify-ok-"));
    const pack = await writePack(root);
    const target = path.join(root, "site");
    await mkdir(path.join(target, "src/content/portfolio/en"), { recursive: true });
    await mkdir(path.join(target, "public/images/portfolio"), { recursive: true });
    await writeFile(
      path.join(target, "src/content/portfolio/en/portraits.md"),
      await readFile(path.join(pack, "portfolio/portraits.md"), "utf8"),
    );
    await writeFile(path.join(target, "public/images/portfolio/portraits-hero.jpg"), FATHER);
    await writeFile(path.join(target, "public/images/portfolio/portraits-1.jpg"), ACTOR);

    const result = await verifyGallery({ pack, target, locale: "en" });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
