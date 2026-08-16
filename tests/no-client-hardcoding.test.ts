import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const FORBIDDEN = /jeffmidghall|byserafin|cuisineandart|gerry-sites\/site-/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

describe("no client hardcoding", () => {
  it("does not embed client hostnames, artist sites, or repo paths in src/", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (FORBIDDEN.test(text)) hits.push(path.relative(SRC, file));
    }
    expect(hits, `client-specific strings in: ${hits.join(", ")}`).toEqual([]);
  });
});
