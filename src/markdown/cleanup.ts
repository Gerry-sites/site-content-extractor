const SOCIAL_HREF = /facebook\.com|instagram\.com|twitter\.com|x\.com|^mailto:/i;
const YEAR_HEADING =
  /(?:^|\n)#+\s*((?:19|20)\d{2})(?:\s*[-–—]\s*(?:[Oo]ngoing|(?:19|20)\d{2}))?\s*(?:\n|$)/;
const YEAR_LINE =
  /^(?:#{1,6}\s*)?((?:19|20)\d{2})(?:\s*[-–—]\s*(?:[Oo]ngoing|(?:19|20)\d{2}))?\s*$/;

export function stripTitleSuffix(title: string): string {
  const next = title.replace(/\s*\|\s*[^|]+$/, "").trim();
  return next || title;
}

export function polishTitle(title: string): string {
  const stripped = stripTitleSuffix(title);
  const letters = stripped.replace(/[^A-Za-z]/g, "");
  if (!letters || /[a-z]/.test(stripped)) return stripped;
  return stripped
    .toLowerCase()
    .replace(
      /(^|[^a-z0-9])([a-z])/g,
      (_, prefix: string, char: string) => prefix + char.toUpperCase(),
    );
}

export function looksLikeChromeDescription(text: string): boolean {
  const trimmed = text
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return true;
  if (/click to see larger/i.test(trimmed)) return true;
  if (/^(above|below)\s*\/\s+\S/i.test(trimmed) && trimmed.length < 140) return true;
  if (/^like loading/i.test(trimmed)) return true;
  if (YEAR_LINE.test(trimmed)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return true;
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length < 40 && /\d+\/\d+/.test(compact)) return true;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!/[a-z]/.test(trimmed) && letters.length >= 3 && trimmed.length < 40) return true;
  if (
    !trimmed.includes(" ") &&
    /[A-Z]/.test(trimmed) &&
    trimmed === trimmed.toUpperCase() &&
    trimmed.length >= 6
  ) {
    return true;
  }
  if (letters.length >= 8 && letters === letters.toUpperCase() && trimmed.length < 80) {
    return true;
  }
  return false;
}

export function looksLikeGluedDescription(text: string): boolean {
  const raw = text.replace(/\u200b/g, "");
  if (/[a-z][A-Z]{4,}/.test(raw)) return true;
  const jammedCaps = /[A-Z]{8,}/.test(raw.replace(/[\s\u200b]/g, ""));
  return jammedCaps && /[A-Z][a-z]{2,}/.test(raw);
}

export function firstProseParagraph(text: string): string | undefined {
  const blocks = text
    .replace(/\u200b/g, "")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .replace(/^#{1,6}\s+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  for (const block of blocks) {
    const prose = block
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!prose || looksLikeChromeDescription(prose) || YEAR_LINE.test(prose)) continue;
    if (prose.length < 24) continue;
    return prose;
  }
  return undefined;
}

export function polishDescription(text: string | undefined, body: string, title: string): string {
  const fallback = firstProseParagraph(body) || polishTitle(title);
  const fromField = (text ?? "")
    .replace(/\u200b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!fromField || looksLikeChromeDescription(fromField) || looksLikeGluedDescription(fromField)) {
    return fallback.slice(0, 180);
  }
  return fromField.slice(0, 180);
}

export function yearFromHeadings(text: string): string | undefined {
  const match = text.match(YEAR_HEADING);
  return match ? `${match[1]}-01-01` : undefined;
}

export function stripYearHeadings(body: string): string {
  return body
    .replace(/^#{1,6}\s*((?:19|20)\d{2})(?:\s*[-–—]\s*(?:[Oo]ngoing|(?:19|20)\d{2}))?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanMarkdownBody(body: string, title?: string): string {
  let next = body.replace(/\u200b/g, "");
  next = next.replace(/^#{1,6}\s+\[[^\]]*\]\([^)]+\)\s*$/gm, "");
  next = next.replace(
    /^[-*]\s+\[[^\]]*\]\((https?:\/\/[^)]+|mailto:[^)]+)\)\s*$/gm,
    (line, href) => (isSocialOrMailHref(href) ? "" : line),
  );
  next = next.replace(/^#{1,6}\s*$/gm, "");
  next = next.replace(/^#{1,6}\s+(.+)$/gm, (full, content: string) => {
    const text = content.trim();
    if (text.length >= 80 || /[.?!]/.test(text)) return text;
    return full;
  });
  next = next.replace(/^.*click to see larger.*$/gim, "");
  next = next.replace(/^#{1,6}\s+\*?Share this:?\*?\s*$/gim, "");
  next = next.replace(/^Like Loading\.+\s*$/gim, "");
  next = next.replace(
    /^\[[^\]]+\]\([^)]+\)(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}In\s+"[^"]+"\s*$/gim,
    "",
  );
  next = next.replace(/^#{1,6}\s+\*?Related\*?\s*$/gim, "");
  next = next.replace(/\[!\[[^\]]*\]\([^)]+\)\]\(#unique-identifier\)\s*/g, "");
  next = next.replace(/\[\]\(#unique-identifier\)/g, "");
  if (title) {
    const heading = stripTitleSuffix(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`^#{1,6}\\s+${heading}\\s*$`, "gim"), "");
  }
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

export function localImagePaths(markdown: string): string[] {
  const found: string[] = [];
  const re = /(?:\(|src=["'])(\/images\/[^)\s"']+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    const src = match[1]!.split("?")[0];
    if (!found.includes(src)) found.push(src);
  }
  return found;
}

export { galleryWithoutHero } from "../pack/gallery.js";

export function stripLocalImageEmbeds(body: string, locals: string[]): string {
  let next = body;
  for (const local of locals) {
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n*`, "g"), "");
  }
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

export function isSocialOrMailHref(href: string): boolean {
  return SOCIAL_HREF.test(href);
}
