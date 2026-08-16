/**
 * Minimal XML → JS object parser for sitemap documents.
 * Avoids an extra dependency for simple sitemap.xml shapes.
 */
export class XMLParser {
  parse(xml: string): Record<string, unknown> {
    const cleaned = xml
      .replace(/<\?xml[^>]*\?>/i, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim();

    const rootMatch = cleaned.match(/<([A-Za-z_][\w:.-]*)[^>]*>([\s\S]*)<\/\1>/);
    if (!rootMatch) return {};

    const rootName = stripNs(rootMatch[1]!);
    const body = rootMatch[2]!;
    return { [rootName]: this.parseChildren(body) };
  }

  private parseChildren(body: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const tagRe = /<([A-Za-z_][\w:.-]*)([^>]*)>([\s\S]*?)<\/\1>|<([A-Za-z_][\w:.-]*)([^>]*)\/>/g;
    let match: RegExpExecArray | null;

    while ((match = tagRe.exec(body)) !== null) {
      const name = stripNs(match[1] || match[4] || "");
      const inner = match[3];
      let value: unknown;

      if (inner === undefined) {
        value = "";
      } else if (/<[A-Za-z_]/.test(inner)) {
        value = this.parseChildren(inner);
      } else {
        value = decodeXml(inner.trim());
      }

      if (name in result) {
        const existing = result[name];
        result[name] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        result[name] = value;
      }
    }

    return result;
  }
}

function stripNs(name: string): string {
  const parts = name.split(":");
  return parts[parts.length - 1] || name;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
