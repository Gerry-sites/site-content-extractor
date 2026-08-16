import { wixMediaId } from "../../media/urls.js";

export type WixGalleryItemMeta = {
  mediaUrl: string;
  title?: string;
  description?: string;
};

type Warmup = {
  pages?: { appsWarmupData?: Record<string, Record<string, unknown>> };
  appsWarmupData?: Record<string, Record<string, unknown>>;
};

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function mediaFileName(src: string): string {
  const trimmed = src.split("?")[0] ?? src;
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const name = slash === -1 ? trimmed : trimmed.slice(slash + 1);
  return decodePath(name).toLowerCase();
}

function isGalleryItem(raw: unknown): raw is {
  mediaUrl?: string;
  metaData?: { title?: string; description?: string; name?: string };
} {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as { mediaUrl?: unknown; metaData?: { name?: unknown } };
  return typeof row.mediaUrl === "string" || typeof row.metaData?.name === "string";
}

function collectGalleryItems(node: unknown, items: WixGalleryItemMeta[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) collectGalleryItems(child, items, seen);
    return;
  }
  const record = node as { items?: unknown };
  if (Array.isArray(record.items) && record.items.some(isGalleryItem)) {
    for (const raw of record.items) {
      if (!isGalleryItem(raw)) continue;
      const mediaUrl = raw.mediaUrl || raw.metaData?.name;
      if (!mediaUrl || seen.has(mediaUrl)) continue;
      seen.add(mediaUrl);
      const title = raw.metaData?.title?.trim() || undefined;
      const description = raw.metaData?.description?.trim() || undefined;
      if (!title && !description) continue;
      items.push({ mediaUrl, title, description });
    }
  }
  for (const child of Object.values(node)) collectGalleryItems(child, items, seen);
}

export function extractWixGalleryItems(html: string): WixGalleryItemMeta[] {
  const match = html.match(/<script[^>]*id=["']wix-warmup-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return [];
  let warm: Warmup;
  try {
    warm = JSON.parse(match[1]) as Warmup;
  } catch {
    return [];
  }

  const items: WixGalleryItemMeta[] = [];
  collectGalleryItems(warm.pages?.appsWarmupData ?? warm.appsWarmupData ?? {}, items, new Set());
  return items;
}

export function matchWixGalleryItem(
  src: string,
  items: WixGalleryItemMeta[],
): WixGalleryItemMeta | undefined {
  const srcId = wixMediaId(src);
  if (srcId) {
    const exact = items.find((item) => wixMediaId(item.mediaUrl) === srcId);
    if (exact) return exact;
  }
  const srcFile = mediaFileName(src);
  return items.find((item) => {
    const itemFile = mediaFileName(item.mediaUrl);
    return Boolean(itemFile) && srcFile === itemFile;
  });
}

/** Keep Wix Pro Gallery order so titles stay on the same works as on the source site. */
export function orderImagesByWixGallery<T extends { src: string }>(
  images: T[],
  items: WixGalleryItemMeta[],
): T[] {
  const byId = new Map<string, T>();
  for (const img of images) {
    const id = wixMediaId(img.src);
    if (id && !byId.has(id)) byId.set(id, img);
  }
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = wixMediaId(item.mediaUrl);
    const img = id ? byId.get(id) : undefined;
    if (!img || seen.has(img.src)) continue;
    seen.add(img.src);
    ordered.push(img);
  }
  for (const img of images) {
    if (seen.has(img.src)) continue;
    seen.add(img.src);
    ordered.push(img);
  }
  return ordered;
}

export function applyWixGalleryMetadata<T extends { src: string; alt?: string }>(
  images: T[],
  html: string,
): Array<T & { title?: string; caption?: string }> {
  const items = extractWixGalleryItems(html);
  if (!items.length) return images;
  return images.map((img) => {
    const meta = matchWixGalleryItem(img.src, items);
    if (!meta) return img;
    return {
      ...img,
      alt: img.alt || meta.title,
      title: meta.title,
      caption: meta.description,
    };
  });
}
