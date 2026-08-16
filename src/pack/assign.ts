import path from "node:path";
import { copyFile } from "node:fs/promises";
import type { ExtractedPage } from "../types/schemas.js";
import type { DownloadedImage } from "../download/images.js";
import { ensureDir, exists } from "../utils/fs.js";
import { isSkippableAsset, upgradeMediaUrl } from "../media/urls.js";
import {
  extFromPath,
  packFileFromSitePath,
  packFolder,
  siteGalleryPath,
  siteHeroPath,
} from "./paths.js";

export async function assignSiteImagePaths(
  pages: ExtractedPage[],
  byRemoteUrl: Map<string, DownloadedImage>,
  outputDir: string,
  skipBlog?: boolean,
): Promise<Map<string, string>> {
  const sitePaths = new Map<string, string>();

  for (const page of pages) {
    const folder = packFolder(page.kind, page.isBlogPost, skipBlog);
    let galleryIndex = 1;

    const ordered: string[] = [];
    if (page.heroImage) ordered.push(page.heroImage);
    for (const gallery of page.galleries) {
      for (const src of gallery.images) {
        if (!ordered.includes(src)) ordered.push(src);
      }
    }
    for (const img of page.images) {
      if (!ordered.includes(img.src)) ordered.push(img.src);
    }

    for (const remote of ordered) {
      const downloaded =
        byRemoteUrl.get(remote) || byRemoteUrl.get(upgradeMediaUrl(remote));
      if (!downloaded) continue;
      if (isSkippableAsset(remote)) continue;
      const ext = extFromPath(downloaded.relativePath);
      const sitePath =
        remote === page.heroImage && !sitePaths.has(remote)
          ? siteHeroPath(folder, page.slug, ext)
          : siteGalleryPath(folder, page.slug, galleryIndex++, ext);

      if (!sitePaths.has(remote)) {
        sitePaths.set(remote, sitePath);
        sitePaths.set(upgradeMediaUrl(remote), sitePath);
        const dest = path.join(outputDir, packFileFromSitePath(sitePath));
        await ensureDir(path.dirname(dest));
        if (!(await exists(dest))) {
          await copyFile(downloaded.localPath, dest);
        }
      }
    }
  }

  return sitePaths;
}
