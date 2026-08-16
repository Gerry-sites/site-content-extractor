import type { DownloadedImage } from "../download/images.js";
import { platformMediaId } from "../media/identity.js";
import { upgradeMediaUrl } from "../media/urls.js";
import type { ExtractedPage } from "../types/schemas.js";
import type { AssignedImages } from "./assign.js";

export type ImageManifestEntry = {
  remoteUrl: string;
  relativePath: string;
  hash: string;
  bytes: number;
  mediaId?: string;
  sitePaths?: string[];
};

function lookupDownload(
  byRemoteUrl: Map<string, DownloadedImage>,
  remote: string,
): DownloadedImage | undefined {
  return byRemoteUrl.get(remote) || byRemoteUrl.get(upgradeMediaUrl(remote));
}

/** Copy download hash and CMS media id onto extracted images before Markdown is written. */
export function stampPageImageIdentity(
  pages: ExtractedPage[],
  byRemoteUrl: Map<string, DownloadedImage>,
): void {
  for (const page of pages) {
    for (const img of page.images) {
      img.mediaId = img.mediaId || platformMediaId(img.src);
      const downloaded = lookupDownload(byRemoteUrl, img.src);
      if (downloaded) img.hash = downloaded.hash;
    }
  }
}

function sitePathsFor(assigned: AssignedImages, remote: string): string[] {
  const paths = new Set<string>();
  const global =
    assigned.byRemoteUrl.get(remote) || assigned.byRemoteUrl.get(upgradeMediaUrl(remote));
  if (global) paths.add(global);
  for (const pageMap of assigned.byPageUrl.values()) {
    const sitePath = pageMap.get(remote) || pageMap.get(upgradeMediaUrl(remote));
    if (sitePath) paths.add(sitePath);
  }
  return [...paths].sort();
}

export function imageManifestEntries(
  images: DownloadedImage[],
  assigned?: AssignedImages,
): ImageManifestEntry[] {
  return images.map((img) => {
    const mediaId = platformMediaId(img.remoteUrl);
    const sitePaths = assigned ? sitePathsFor(assigned, img.remoteUrl) : undefined;
    const entry: ImageManifestEntry = {
      remoteUrl: img.remoteUrl,
      relativePath: img.relativePath,
      hash: img.hash,
      bytes: img.bytes,
    };
    if (mediaId) entry.mediaId = mediaId;
    if (sitePaths?.length) entry.sitePaths = sitePaths;
    return entry;
  });
}
