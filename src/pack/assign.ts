import path from "node:path";
import { copyFile } from "node:fs/promises";
import type { ExtractedPage } from "../types/schemas.js";
import type { DownloadedImage } from "../download/images.js";
import { ensureDir, filesEqual } from "../utils/fs.js";
import { isSkippableAsset, upgradeMediaUrl } from "../media/urls.js";
import {
  extFromPath,
  packFileFromSitePath,
  packFolder,
  siteGalleryPath,
  siteHeroPath,
} from "./paths.js";

export type AssignedImages = {
  byRemoteUrl: Map<string, string>;
  byPageUrl: Map<string, Map<string, string>>;
};

function lookupDownload(
  byRemoteUrl: Map<string, DownloadedImage>,
  remote: string,
): DownloadedImage | undefined {
  return byRemoteUrl.get(remote) || byRemoteUrl.get(upgradeMediaUrl(remote));
}

export async function assignSiteImagePaths(
  pages: ExtractedPage[],
  byRemoteUrl: Map<string, DownloadedImage>,
  outputDir: string,
  skipBlog?: boolean,
): Promise<AssignedImages> {
  const sitePaths = new Map<string, string>();
  const byPageUrl = new Map<string, Map<string, string>>();

  for (const page of pages) {
    const folder = packFolder(page.kind, page.isBlogPost, skipBlog);
    let galleryIndex = 1;
    const pageMap = new Map<string, string>();

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
      const downloaded = lookupDownload(byRemoteUrl, remote);
      if (!downloaded) continue;
      if (isSkippableAsset(remote)) continue;
      const ext = extFromPath(downloaded.relativePath);
      const isHero =
        Boolean(page.heroImage) &&
        (remote === page.heroImage ||
          upgradeMediaUrl(remote) === page.heroImage ||
          remote === upgradeMediaUrl(page.heroImage!));
      const sitePath = isHero
        ? siteHeroPath(folder, page.slug, ext)
        : siteGalleryPath(folder, page.slug, galleryIndex++, ext);

      pageMap.set(remote, sitePath);
      pageMap.set(upgradeMediaUrl(remote), sitePath);
      if (!sitePaths.has(remote)) {
        sitePaths.set(remote, sitePath);
        sitePaths.set(upgradeMediaUrl(remote), sitePath);
      }
      const dest = path.join(outputDir, packFileFromSitePath(sitePath));
      await ensureDir(path.dirname(dest));
      if (!(await filesEqual(downloaded.localPath, dest))) {
        await copyFile(downloaded.localPath, dest);
      }
    }
    byPageUrl.set(page.url, pageMap);
  }

  return { byRemoteUrl: sitePaths, byPageUrl };
}
