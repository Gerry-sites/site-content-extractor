import { galleryIdentityKey } from "../media/identity.js";

export type GalleryItem = {
  src: string;
  title?: string;
  caption?: string;
  mediaId?: string;
  hash?: string;
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

export function galleryItemIdentity(item: GalleryEntry): string | undefined {
  if (typeof item === "string") return undefined;
  return galleryIdentityKey(item);
}

export function galleryItemsMatch(left: GalleryEntry, right: GalleryEntry): boolean {
  const leftKey = galleryItemIdentity(left);
  const rightKey = galleryItemIdentity(right);
  if (leftKey && rightKey) return leftKey === rightKey;
  return galleryItemSrc(left) === galleryItemSrc(right);
}

export function findMatchingGalleryItem(
  haystack: GalleryEntry[] | undefined,
  needle: GalleryEntry,
): GalleryEntry | undefined {
  const items = asGalleryEntries(haystack);
  const needleKey = galleryItemIdentity(needle);
  if (needleKey) {
    const byId = items.find((item) => galleryItemIdentity(item) === needleKey);
    if (byId) return byId;
  }
  const src = galleryItemSrc(needle);
  return items.find((item) => galleryItemSrc(item) === src);
}

function asGalleryItem(item: GalleryEntry): GalleryItem {
  return typeof item === "string" ? { src: item } : item;
}

function mergeGalleryItem(current: GalleryEntry, incoming: GalleryEntry): GalleryItem {
  const have = asGalleryItem(current);
  const meta = asGalleryItem(incoming);
  const next: GalleryItem = { src: galleryItemSrc(current) };
  const title = meta.title || have.title;
  const caption = meta.caption || have.caption;
  const mediaId = meta.mediaId || have.mediaId;
  const hash = meta.hash || have.hash;
  if (title) next.title = title;
  if (caption) next.caption = caption;
  if (mediaId) next.mediaId = mediaId;
  if (hash) next.hash = hash;
  return next;
}

export function captionsNeedMerge(
  existing: GalleryEntry[] | undefined,
  pack: GalleryEntry[] | undefined,
): boolean {
  const current = asGalleryEntries(existing);
  const incoming = asGalleryEntries(pack);
  for (const item of incoming) {
    if (typeof item === "string") continue;
    const have = findMatchingGalleryItem(current, item);
    if (item.title || item.caption) {
      if (!have || typeof have === "string") return true;
      if (item.title && item.title !== have.title) return true;
      if (item.caption && item.caption !== have.caption) return true;
    }
    if (item.mediaId || item.hash) {
      if (!have || typeof have === "string") return true;
      if (item.mediaId && item.mediaId !== have.mediaId) return true;
      if (item.hash && item.hash !== have.hash) return true;
    }
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
      const next: GalleryItem = { src: row.src };
      if (row.title) next.title = row.title;
      if (row.caption) next.caption = row.caption;
      if (row.mediaId) next.mediaId = row.mediaId;
      if (row.hash) next.hash = row.hash;
      out.push(next);
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

  const unused = [...incoming];
  function takeMatch(item: GalleryEntry): GalleryEntry | undefined {
    const idx = unused.findIndex((candidate) => galleryItemsMatch(item, candidate));
    if (idx === -1) return undefined;
    const [meta] = unused.splice(idx, 1);
    return meta;
  }

  const seen = new Set<string>();
  const out: GalleryEntry[] = [];
  const source = current.length ? current : incoming;
  for (const item of source) {
    const src = galleryItemSrc(item);
    if (seen.has(src)) continue;
    seen.add(src);
    const meta = takeMatch(item);
    if (!meta) {
      out.push(typeof item === "string" ? src : item);
      continue;
    }
    out.push(mergeGalleryItem(item, meta));
  }
  for (const item of unused) {
    const src = galleryItemSrc(item);
    if (seen.has(src)) continue;
    seen.add(src);
    out.push(typeof item === "string" ? src : item);
  }
  return out;
}
