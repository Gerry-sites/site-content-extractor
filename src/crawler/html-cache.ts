import path from "node:path";
import { readFile } from "node:fs/promises";
import { ensureDir, exists, readJson, writeJson, writeText } from "../utils/fs.js";
import { shortHash } from "../utils/hash.js";

export type HtmlIndex = Record<string, string>;

export function htmlCachePath(outputDir: string): string {
  return path.join(outputDir, "html-index.json");
}

export async function loadHtmlCache(outputDir: string): Promise<{
  htmlByUrl: Map<string, string>;
  index: HtmlIndex;
}> {
  const htmlByUrl = new Map<string, string>();
  const indexPath = htmlCachePath(outputDir);
  if (!(await exists(indexPath))) {
    return { htmlByUrl, index: {} };
  }
  const index = (await readJson<HtmlIndex>(indexPath)) ?? {};
  for (const [url, rel] of Object.entries(index)) {
    const file = path.join(outputDir, rel);
    if (!(await exists(file))) continue;
    htmlByUrl.set(url, await readFile(file, "utf8"));
  }
  return { htmlByUrl, index };
}

export async function saveHtmlPage(
  outputDir: string,
  url: string,
  html: string,
  index: HtmlIndex,
): Promise<void> {
  const rel = `html/${shortHash(url, 16)}.html`;
  await writeText(path.join(outputDir, rel), html);
  index[url] = rel;
}

export async function writeHtmlIndex(outputDir: string, index: HtmlIndex): Promise<void> {
  await ensureDir(outputDir);
  await writeJson(htmlCachePath(outputDir), index);
}
