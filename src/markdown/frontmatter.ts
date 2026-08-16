import yaml from "js-yaml";
import { FrontmatterSchema, type Frontmatter } from "../types/schemas.js";

export function buildFrontmatter(input: Frontmatter): Frontmatter {
  return FrontmatterSchema.parse(input);
}

export function serializeMarkdownFile(frontmatter: Frontmatter, body: string): string {
  const validated = buildFrontmatter(frontmatter);
  const yamlBlock = yaml
    .dump(validated, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
      skipInvalid: true,
    })
    .trimEnd();

  const cleanBody = body.replace(/^---[\s\S]*?---\s*/, "").trim();
  return `---\n${yamlBlock}\n---\n\n${cleanBody}\n`;
}

export function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: markdown };
  }
  // CORE_SCHEMA keeps ISO dates as strings (DEFAULT_SCHEMA would parse 1970-01-01 as Date).
  const frontmatter =
    (yaml.load(match[1]!, { schema: yaml.CORE_SCHEMA }) as Record<string, unknown>) ?? {};
  return { frontmatter, body: match[2] ?? "" };
}
