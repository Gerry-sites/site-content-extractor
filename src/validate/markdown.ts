import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { exists } from "../utils/fs.js";
import { parseFrontmatter } from "../markdown/frontmatter.js";
import { FrontmatterSchema } from "../types/schemas.js";
import { isSkippableAsset } from "../media/urls.js";

export type ValidationIssue = {
  file: string;
  level: "error" | "warning";
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export async function validateOutput(outputDir: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const mdFiles = await collectMarkdownFiles(outputDir);
  const slugs = new Map<string, string>();
  const filenames = new Map<string, string>();

  for (const file of mdFiles) {
    const rel = path.relative(outputDir, file).replace(/\\/g, "/");
    const base = path.basename(file);
    if (filenames.has(base)) {
      issues.push({
        file: rel,
        level: "error",
        message: `Duplicate filename "${base}" also used by ${filenames.get(base)}`,
      });
    } else {
      filenames.set(base, rel);
    }

    const raw = await readFile(file, "utf8");
    const { frontmatter } = parseFrontmatter(raw);
    const parsed = FrontmatterSchema.safeParse(frontmatter);

    if (!parsed.success) {
      for (const err of parsed.error.issues) {
        issues.push({
          file: rel,
          level: "error",
          message: `Invalid frontmatter: ${err.path.join(".")} — ${err.message}`,
        });
      }
      continue;
    }

    const fm = parsed.data;
    if (!fm.title?.trim()) {
      issues.push({ file: rel, level: "error", message: "Missing title" });
    }
    if (!fm.description?.trim()) {
      issues.push({ file: rel, level: "error", message: "Missing description" });
    }
    if (!fm.slug?.trim()) {
      issues.push({ file: rel, level: "error", message: "Missing slug" });
    } else if (slugs.has(fm.slug)) {
      issues.push({
        file: rel,
        level: "error",
        message: `Duplicate slug "${fm.slug}" also used by ${slugs.get(fm.slug)}`,
      });
    } else {
      slugs.set(fm.slug, rel);
    }

    const isBlog = rel.startsWith("blog/");
    const isPortfolio = rel.startsWith("portfolio/");
    if (isBlog && (!fm.date || fm.date === "1970-01-01")) {
      issues.push({
        file: rel,
        level: "error",
        message: "Missing real date (1970-01-01 means article date was not found)",
      });
    } else if (isPortfolio && (!fm.date || fm.date === "1970-01-01")) {
      issues.push({
        file: rel,
        level: "warning",
        message: "Missing real date (1970-01-01 means article date was not found)",
      });
    }

    // Validate image references exist on disk
    const imageRefs = [
      ...(fm.heroImage ? [fm.heroImage] : []),
      ...(fm.gallery ?? []),
      ...extractMarkdownImages(raw),
    ];

    for (const ref of imageRefs) {
      if (/^https?:\/\//i.test(ref)) {
        if (isSkippableAsset(ref)) continue;
        issues.push({
          file: rel,
          level: "error",
          message: `Remote content image remains: ${ref}`,
        });
        continue;
      }
      const relative = ref.replace(/^\//, "");
      const candidates = [
        path.join(outputDir, relative),
        path.join(outputDir, ref),
        path.join(path.dirname(file), ref),
        path.join(outputDir, "images", path.basename(ref)),
      ];
      const found = await Promise.any(
        candidates.map(async (c) => ((await exists(c)) ? c : Promise.reject())),
      ).catch(() => null);

      if (!found) {
        issues.push({
          file: rel,
          level: "error",
          message: `Missing image file for reference: ${ref}`,
        });
      }
    }
  }

  return {
    ok: issues.filter((i) => i.level === "error").length === 0,
    issues,
  };
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "images" || entry.name === "node_modules" || entry.name === "html") {
          continue;
        }
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "report.md") {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

function extractMarkdownImages(markdown: string): string[] {
  const refs: string[] = [];
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const src = match[1]?.trim();
    if (src) refs.push(src.split(/\s+/)[0]!);
  }
  return refs;
}
