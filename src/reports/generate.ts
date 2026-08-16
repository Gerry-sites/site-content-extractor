import type { MigrationReport } from "../types/schemas.js";
import { writeText } from "../utils/fs.js";
import path from "node:path";

export function buildReportMarkdown(report: MigrationReport): string {
  const lines = [
    "# Migration Summary",
    "",
    `**Seed URL:** ${report.seedUrl}`,
    "",
    `**Platform:** ${report.platform}`,
    "",
    `**Started:** ${report.startedAt}`,
    "",
    `**Finished:** ${report.finishedAt}`,
    "",
    "## Counts",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Pages | ${report.pages} |`,
    `| Blog Posts | ${report.blogPosts} |`,
    `| Images | ${report.images} |`,
    `| Galleries | ${report.galleries} |`,
    `| Broken Images | ${report.brokenImages.length} |`,
    `| Broken Links | ${report.brokenLinks.length} |`,
    `| Missing Metadata | ${report.missingMetadata.length} |`,
    "",
    "## Coverage",
    "",
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Discovered | ${report.coverage?.discovered ?? report.pages} |`,
    `| With HTML | ${report.coverage?.withHtml ?? report.pages} |`,
    `| Missing HTML | ${report.coverage?.missingHtml.length ?? 0} |`,
    `| Missing Markdown | ${report.coverage?.missingMarkdown.length ?? 0} |`,
    `| Missing Images | ${report.coverage?.missingImages.length ?? 0} |`,
    `| Leftover remote | ${report.coverage?.leftoverRemote.length ?? 0} |`,
    "",
    "## Review",
    "",
    "See `image-review.json` for per-image flags (chrome, other-host, title-name-in-media, inline-blog).",
    "",
  ];

  const coverage = report.coverage;
  if (coverage?.missingHtml.length) {
    lines.push("### Missing HTML", "");
    for (const url of coverage.missingHtml) lines.push(`- ${url}`);
    lines.push("");
  }
  if (coverage?.seedMissing.length) {
    lines.push("### Extra seeds not found", "");
    for (const seed of coverage.seedMissing) {
      lines.push(`- ${seed.path} (HTTP ${seed.status ?? "?"})`);
    }
    lines.push("");
  }

  if (report.brokenImages.length) {
    lines.push("## Broken Images", "");
    for (const url of report.brokenImages) lines.push(`- ${url}`);
    lines.push("");
  }

  if (report.brokenLinks.length) {
    lines.push("## Broken Links", "");
    for (const url of report.brokenLinks) lines.push(`- ${url}`);
    lines.push("");
  }

  if (report.missingMetadata.length) {
    lines.push("## Missing Metadata", "");
    for (const item of report.missingMetadata) lines.push(`- ${item}`);
    lines.push("");
  }

  if (report.warnings.length) {
    lines.push("## Warnings", "");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  if (report.recommendations.length) {
    lines.push("## Recommendations", "");
    for (const rec of report.recommendations) lines.push(`- ${rec}`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function writeReport(outputDir: string, report: MigrationReport): Promise<string> {
  const content = buildReportMarkdown(report);
  const filePath = path.join(outputDir, "report.md");
  await writeText(filePath, content);
  return filePath;
}
