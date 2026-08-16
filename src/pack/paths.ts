export const MISSING_DATE = "1970-01-01";

export type PackFolder = "pages" | "blog" | "portfolio";

export function packFolder(kind: string, isBlogPost: boolean, skipBlog?: boolean): PackFolder {
  if (isBlogPost && !skipBlog) return "blog";
  if (kind === "portfolio" || kind === "gallery") return "portfolio";
  return "pages";
}

export function extFromPath(filePath: string): string {
  const match = filePath.match(/\.(jpe?g|png|gif|webp|avif)$/i);
  return match ? match[0]!.toLowerCase().replace("jpeg", "jpg") : ".jpg";
}

export function siteHeroPath(folder: PackFolder, slug: string, ext = ".jpg"): string {
  return `/images/${folder}/${slug}-hero${ext}`;
}

export function siteGalleryPath(
  folder: PackFolder,
  slug: string,
  index: number,
  ext = ".jpg",
): string {
  return `/images/${folder}/${slug}-${index}${ext}`;
}

export function packFileFromSitePath(sitePath: string): string {
  return sitePath.replace(/^\//, "");
}
