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
  const decoded = decodePath(src);
  return items.find((item) => {
    if (!item.mediaUrl) return false;
    if (src.includes(item.mediaUrl) || decoded.includes(item.mediaUrl)) return true;
    const mediaFile = mediaFileName(item.mediaUrl);
    return Boolean(mediaFile) && decoded.toLowerCase().includes(mediaFile);
  });
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
