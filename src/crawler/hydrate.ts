const LOAD_MORE_RE = /load more|show more|more posts|see more/i;

export type HydratedImage = {
  src?: string;
  currentSrc?: string;
};

/**
 * Rewrite <img src> to the browser's currentSrc so Cheerio sees hydrated Wix/WP URLs.
 */
export function applyCurrentSrc(html: string, images: HydratedImage[]): string {
  let next = html;
  for (const img of images) {
    const live = img.currentSrc?.trim();
    const original = img.src?.trim();
    if (!live || live.startsWith("data:")) continue;
    if (original && original !== live) {
      next = next.split(`src="${original}"`).join(`src="${live}"`);
      next = next.split(`src='${original}'`).join(`src='${live}'`);
    }
  }
  return next;
}

export function injectResourceImages(html: string, resourceUrls: string[]): string {
  const extras: string[] = [];
  for (const url of resourceUrls) {
    if (!url || url.startsWith("data:")) continue;
    if (!/wixstatic|wp\.com|wp-content|wordpress\.com/i.test(url)) continue;
    if (html.includes(url)) continue;
    extras.push(`<img src="${url}" alt="" data-hydrate-resource="true" />`);
  }
  if (!extras.length) return html;
  return html.replace(/<\/body>/i, `${extras.join("")}</body>`);
}

export function isLoadMoreLabel(text: string): boolean {
  return LOAD_MORE_RE.test(text.replace(/\s+/g, " ").trim());
}
