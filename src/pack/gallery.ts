export type GalleryItem = {
  src: string;
  title?: string;
  caption?: string;
};

export type GalleryEntry = string | GalleryItem;

export function galleryItemSrc(item: GalleryEntry): string {
  const raw = typeof item === "string" ? item : item.src;
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

export function gallerySrcs(items: unknown): string[] {
  return asGalleryEntries(items).map(galleryItemSrc).filter(Boolean);
}

export function captionsNeedMerge(
  existing: GalleryEntry[] | undefined,
  pack: GalleryEntry[] | undefined,
): boolean {
  const current = asGalleryEntries(existing);
  const incoming = asGalleryEntries(pack);
  const bySrc = new Map(current.map((item) => [galleryItemSrc(item), item]));
  for (const item of incoming) {
    if (typeof item === "string") continue;
    if (!item.title && !item.caption) continue;
    const have = bySrc.get(galleryItemSrc(item));
    if (!have || typeof have === "string") return true;
    if (item.title && item.title !== have.title) return true;
    if (item.caption && item.caption !== have.caption) return true;
  }
  return false;
}

export function galleryHasCaptions(items: GalleryEntry[] | undefined): boolean {
  return (items ?? []).some(
    (item) => typeof item !== "string" && Boolean(item.title || item.caption),
  );
}

export function asGalleryEntries(items: unknown): GalleryEntry[] {
  if (!Array.isArray(items)) return [];
  const out: GalleryEntry[] = [];
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      out.push(item);
      continue;
    }
    if (item && typeof item === "object" && typeof (item as GalleryItem).src === "string") {
      const row = item as GalleryItem;
      out.push({
        src: row.src,
        title: row.title,
        caption: row.caption,
      });
    }
  }
  return out;
}

export function galleryWithoutHero(
  hero: string | undefined,
  galleries: Array<GalleryEntry[] | undefined>,
): GalleryEntry[] {
  const seen = new Set<string>();
  const out: GalleryEntry[] = [];
  const heroSrc = hero ? galleryItemSrc(hero) : "";
  for (const list of galleries) {
    if (!list) continue;
    for (const item of list) {
      const src = galleryItemSrc(item);
      if (!src.startsWith("/images/")) continue;
      if (heroSrc && src === heroSrc) continue;
      if (seen.has(src)) continue;
      seen.add(src);
      out.push(typeof item === "string" ? src : { ...item, src });
    }
  }
  return out;
}

export function mergeGalleryCaptions(
  existing: GalleryEntry[] | undefined,
  pack: GalleryEntry[] | undefined,
): GalleryEntry[] {
  const current = asGalleryEntries(existing);
  const incoming = asGalleryEntries(pack);
  if (!incoming.length) return current;
  const bySrc = new Map<string, GalleryItem>();
  for (const item of incoming) {
    if (typeof item === "string") continue;
    bySrc.set(galleryItemSrc(item), item);
  }
  if (!bySrc.size && current.length) return current;

  const seen = new Set<string>();
  const out: GalleryEntry[] = [];
  const source = current.length ? current : incoming;
  for (const item of source) {
    const src = galleryItemSrc(item);
    if (seen.has(src)) continue;
    seen.add(src);
    const meta = bySrc.get(src);
    if (!meta) {
      out.push(typeof item === "string" ? src : item);
      continue;
    }
    out.push({
      src,
      title: meta.title || (typeof item === "string" ? undefined : item.title),
      caption: meta.caption || (typeof item === "string" ? undefined : item.caption),
    });
  }
  for (const item of incoming) {
    const src = galleryItemSrc(item);
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(typeof item === "string" ? src : item);
  }
  return out;
}
