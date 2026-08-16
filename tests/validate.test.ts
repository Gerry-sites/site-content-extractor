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
    expect(result.ok).toBe(true);
    expect(
      result.issues.some(
        (issue) => issue.level === "warning" && /1970-01-01/.test(issue.message),
      ),
    ).toBe(true);
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

  it("fails blog entries that still have the placeholder date", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-validate-"));
    await mkdir(path.join(dir, "blog"), { recursive: true });
    await writeFile(
      path.join(dir, "blog/stew.md"),
      "---\ntitle: Stew\ndescription: Food\nslug: stew\ndate: 1970-01-01\n---\n\nBody.\n",
      "utf8",
    );
    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.level === "error" && /1970-01-01/.test(issue.message))).toBe(
      true,
    );
  });

  it("fails when a content image is still a remote URL", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-validate-"));
    await mkdir(path.join(dir, "pages"), { recursive: true });
    await writeFile(
      path.join(dir, "pages/home.md"),
      "---\ntitle: Home\ndescription: Hi\nslug: home\n---\n\n![A](https://cdn.example.com/a.jpg)\n",
      "utf8",
    );
    const result = await validateOutput(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => /Remote content image remains/.test(issue.message))).toBe(
      true,
    );
  });

  it("does not walk a nested pruned directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-validate-pruned-"));
    await mkdir(path.join(dir, "blog"), { recursive: true });
    await mkdir(path.join(dir, "pruned", "blog"), { recursive: true });
    await writeFile(
      path.join(dir, "blog/stew.md"),
      "---\ntitle: Stew\ndescription: Food\nslug: stew\ndate: 2016-01-01\n---\n\nBody.\n",
      "utf8",
    );
    await writeFile(
      path.join(dir, "pruned/blog/hub.md"),
      "---\ntitle: Hub\ndescription: Index\nslug: hub\ndate: 1970-01-01\n---\n\nLinks.\n",
      "utf8",
    );
    const result = await validateOutput(dir);
    expect(result.ok).toBe(true);
    expect(result.issues.some((issue) => issue.file.includes("pruned/"))).toBe(false);
  });
});
