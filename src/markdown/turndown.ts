import TurndownService from "turndown";
// @ts-expect-error no types for turndown-plugin-gfm
import { gfm } from "turndown-plugin-gfm";

export function createTurndown(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    hr: "---",
  });

  turndown.use(gfm);

  // Drop empty links and javascript: links
  turndown.addRule("stripEmptyLinks", {
    filter: (node) =>
      node.nodeName === "A" &&
      (!(node as HTMLAnchorElement).href ||
        (node as HTMLAnchorElement).href.startsWith("javascript:")),
    replacement: (content) => content,
  });

  // Prefer figcaption as alt text when present
  turndown.addRule("figureImages", {
    filter: "figure",
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const img = el.querySelector("img");
      if (!img) return _content;
      const src = img.getAttribute("src");
      if (!src) return _content;
      const caption =
        el.querySelector("figcaption")?.textContent?.trim() || img.getAttribute("alt") || "";
      return `\n\n![${caption}](${src})\n\n`;
    },
  });

  return turndown;
}

export function htmlToMarkdown(html: string): string {
  const turndown = createTurndown();
  const md = turndown.turndown(html);
  return cleanupMarkdown(md);
}

export function cleanupMarkdown(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "")
    .trim()
    .concat("\n");
}
