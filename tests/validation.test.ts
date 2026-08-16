import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDir, writeText } from "../src/utils/fs.js";
import { validateOutput } from "../src/validate/markdown.js";

describe("markdown validation", () => {
  it("fails when title or slug is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-val-"));
    await ensureDir(path.join(dir, "pages"));
    await writeText(path.join(dir, "pages", "bad.md"), `---\ndescription: nope\n---\n\n# Hi\n`);

    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.toLowerCase().includes("title"))).toBe(true);
  });

  it("passes valid frontmatter with existing images", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-val-"));
    await ensureDir(path.join(dir, "pages"));
    await ensureDir(path.join(dir, "images"));
    await writeText(path.join(dir, "images", "hero.jpg"), "fake");
    await writeText(
      path.join(dir, "pages", "home.md"),
      `---\ntitle: Home\ndescription: Landing\nslug: home\nheroImage: images/hero.jpg\n---\n\n# Home\n\n![Hero](../images/hero.jpg)\n`,
    );

    const result = await validateOutput(dir);
    const errors = result.issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("fails on duplicate slugs and missing image files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-val-"));
    await ensureDir(path.join(dir, "pages"));
    await ensureDir(path.join(dir, "blog"));
    await writeText(path.join(dir, "pages", "a.md"), `---\ntitle: A\nslug: shared\n---\n\n# A\n`);
    await writeText(
      path.join(dir, "blog", "b.md"),
      `---\ntitle: B\nslug: shared\nheroImage: images/missing.jpg\n---\n\n# B\n`,
    );

    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.toLowerCase().includes("duplicate slug"))).toBe(
      true,
    );
    expect(result.issues.some((i) => i.message.toLowerCase().includes("missing image"))).toBe(true);
  });
});
