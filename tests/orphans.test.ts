import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { removeOrphanMarkdown } from "../src/pack/orphans.js";
import { exists } from "../src/utils/fs.js";

describe("orphan markdown cleanup", () => {
  it("deletes markdown files that were not written this run", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-orphan-"));
    await mkdir(path.join(dir, "pages"), { recursive: true });
    await mkdir(path.join(dir, "portfolio"), { recursive: true });
    await writeFile(path.join(dir, "pages/amphorae.md"), "old page\n", "utf8");
    await writeFile(path.join(dir, "portfolio/amphorae.md"), "gallery\n", "utf8");
    await writeFile(path.join(dir, "pages/about.md"), "keep\n", "utf8");

    const removed = await removeOrphanMarkdown(dir, new Set(["portfolio/amphorae.md", "pages/about.md"]));
    expect(removed).toContain("pages/amphorae.md");
    expect(await exists(path.join(dir, "pages/amphorae.md"))).toBe(false);
    expect(await exists(path.join(dir, "portfolio/amphorae.md"))).toBe(true);
    expect(await readFile(path.join(dir, "pages/about.md"), "utf8")).toContain("keep");
  });
});
