import path from "node:path";
import { readdir, rm } from "node:fs/promises";
import { exists } from "../utils/fs.js";

const FOLDERS = ["pages", "blog", "portfolio"] as const;

export async function removeOrphanMarkdown(
  outputDir: string,
  keep: Set<string>,
): Promise<string[]> {
  const removed: string[] = [];
  for (const folder of FOLDERS) {
    const dir = path.join(outputDir, folder);
    if (!(await exists(dir))) continue;
    const entries = await readdir(dir);
    for (const name of entries) {
      if (!name.endsWith(".md")) continue;
      const rel = `${folder}/${name}`;
      if (keep.has(rel)) continue;
      await rm(path.join(dir, name), { force: true });
      removed.push(rel);
    }
  }
  return removed;
}
