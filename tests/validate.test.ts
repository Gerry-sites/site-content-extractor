import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateOutput } from "../src/validate/markdown.js";

describe("pack validation", () => {
  it("fails portfolio entries that still have the placeholder date", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-validate-"));
    await mkdir(path.join(dir, "portfolio"), { recursive: true });
    await writeFile(
      path.join(dir, "portfolio/coast.md"),
      "---\ntitle: Coast\ndescription: Sea\nslug: coast\ndate: 1970-01-01\n---\n\nBody.\n",
      "utf8",
    );
    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => /1970-01-01/.test(issue.message))).toBe(true);
  });

  it("fails when description is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-validate-"));
    await mkdir(path.join(dir, "pages"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/about.md"),
      "---\ntitle: About\nslug: about\n---\n\nBody.\n",
      "utf8",
    );
    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => /Missing description/.test(issue.message))).toBe(true);
  });
});
