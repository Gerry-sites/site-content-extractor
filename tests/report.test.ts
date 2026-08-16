import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildReportMarkdown, writeReport } from "../src/reports/generate.js";
import type { MigrationReport } from "../src/types/schemas.js";

const sampleReport: MigrationReport = {
  seedUrl: "https://example.com",
  platform: "Wix",
  startedAt: "2026-08-07T00:00:00.000Z",
  finishedAt: "2026-08-07T00:01:00.000Z",
  pages: 17,
  blogPosts: 42,
  images: 143,
  galleries: 3,
  brokenImages: ["https://cdn.example.com/missing.jpg"],
  brokenLinks: ["https://example.com/gone"],
  missingMetadata: ["favicon"],
  warnings: ["No HTML captured for https://example.com/old"],
  recommendations: ["Review broken images and replace or remove references."],
};

describe("migration report", () => {
  it("includes summary counts and issue sections", () => {
    const md = buildReportMarkdown(sampleReport);

    expect(md).toContain("# Migration Summary");
    expect(md).toContain("| Pages | 17 |");
    expect(md).toContain("| Blog Posts | 42 |");
    expect(md).toContain("| Images | 143 |");
    expect(md).toContain("| Broken Images | 1 |");
    expect(md).toContain("## Broken Images");
    expect(md).toContain("https://cdn.example.com/missing.jpg");
    expect(md).toContain("## Broken Links");
    expect(md).toContain("## Missing Metadata");
    expect(md).toContain("## Warnings");
    expect(md).toContain("## Recommendations");
    expect(md).toContain("## Coverage");
    expect(md).toContain("| Missing HTML |");
    expect(md).toContain("image-review.json");
    expect(md).toContain("Platform:** Wix");
  });

  it("writes report.md to the output directory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-report-"));
    const filePath = await writeReport(dir, sampleReport);
    expect(filePath).toBe(path.join(dir, "report.md"));

    const content = await readFile(filePath, "utf8");
    expect(content).toContain("Migration Summary");
    expect(content).toContain("https://example.com");
  });
});
