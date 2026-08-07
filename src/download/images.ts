import path from "node:path";
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import pLimit from "p-limit";
import { ensureDir, exists, writeJson, readJson } from "../utils/fs.js";
import { sanitizeFilename } from "../utils/slug.js";
import { sha256, shortHash } from "../utils/hash.js";
import { processImage } from "../images/process.js";
import type { Logger } from "../utils/log.js";

export type DownloadedImage = {
  remoteUrl: string;
  localPath: string;
  relativePath: string;
  hash: string;
  bytes: number;
  thumbRelativePath?: string;
};

export type ImageDownloadResult = {
  images: DownloadedImage[];
  byRemoteUrl: Map<string, DownloadedImage>;
  broken: string[];
};

type ManifestEntry = {
  remoteUrl: string;
  relativePath: string;
  hash: string;
  bytes: number;
};

export async function downloadImages(
  urls: string[],
  outputDir: string,
  options: {
    concurrency?: number;
    userAgent?: string;
    resume?: boolean;
    generateResponsive?: boolean;
    skipProcess?: boolean;
  },
  logger: Logger,
): Promise<ImageDownloadResult> {
  const imagesDir = path.join(outputDir, "images");
  await ensureDir(imagesDir);
  await ensureDir(path.join(imagesDir, "thumbs"));

  const manifestPath = path.join(outputDir, "images-manifest.json");
  const hashToFile = new Map<string, DownloadedImage>();
  const byRemoteUrl = new Map<string, DownloadedImage>();
  const broken: string[] = [];
  const usedNames = new Set<string>();

  if (options.resume && (await exists(manifestPath))) {
    const prior = (await readJson(manifestPath)) as ManifestEntry[];
    for (const entry of prior) {
      const localPath = path.join(outputDir, entry.relativePath);
      if (!(await exists(localPath))) continue;
      const downloaded: DownloadedImage = {
        remoteUrl: entry.remoteUrl,
        localPath,
        relativePath: entry.relativePath,
        hash: entry.hash,
        bytes: entry.bytes,
      };
      hashToFile.set(entry.hash, downloaded);
      byRemoteUrl.set(entry.remoteUrl, downloaded);
      usedNames.add(path.basename(entry.relativePath));
    }
    logger.info(`Resumed ${byRemoteUrl.size} images from manifest`);
  }

  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  const limit = pLimit(options.concurrency ?? 4);

  await Promise.all(
    uniqueUrls.map((remoteUrl) =>
      limit(async () => {
        if (byRemoteUrl.has(remoteUrl)) return;

        try {
          const res = await fetch(remoteUrl, {
            headers: {
              "User-Agent":
                options.userAgent ??
                "site-migrate/0.1 (+https://github.com/site-migrate/site-migrate)",
              Accept: "image/*,*/*",
            },
            signal: AbortSignal.timeout(45_000),
            redirect: "follow",
          });

          if (!res.ok) {
            broken.push(remoteUrl);
            logger.warn(`Broken image (${res.status}): ${remoteUrl}`);
            return;
          }

          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.byteLength === 0) {
            broken.push(remoteUrl);
            return;
          }

          const hash = sha256(buffer);
          const existing = hashToFile.get(hash);
          if (existing) {
            // Deduplicate identical content
            byRemoteUrl.set(remoteUrl, {
              ...existing,
              remoteUrl,
            });
            logger.debug(`Deduped image: ${remoteUrl} -> ${existing.relativePath}`);
            return;
          }

          const filename = chooseFilename(remoteUrl, buffer, usedNames, res);
          usedNames.add(filename);
          const localPath = path.join(imagesDir, filename);
          await writeFile(localPath, buffer);

          let thumbRelativePath: string | undefined;
          if (!options.skipProcess) {
            try {
              const processed = await processImage(localPath, imagesDir, {
                generateResponsive: options.generateResponsive,
              });
              thumbRelativePath = path
                .relative(outputDir, processed.thumbPath)
                .replace(/\\/g, "/");
            } catch (err) {
              logger.debug(
                `Image process skipped for ${filename}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }

          const downloaded: DownloadedImage = {
            remoteUrl,
            localPath,
            relativePath: `images/${filename}`,
            hash,
            bytes: buffer.byteLength,
            thumbRelativePath,
          };
          hashToFile.set(hash, downloaded);
          byRemoteUrl.set(remoteUrl, downloaded);
          logger.debug(`Downloaded image: ${filename}`);
        } catch (err) {
          broken.push(remoteUrl);
          logger.warn(
            `Failed image ${remoteUrl}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    ),
  );

  const images = [...byRemoteUrl.values()];
  const manifest: ManifestEntry[] = images.map((img) => ({
    remoteUrl: img.remoteUrl,
    relativePath: img.relativePath,
    hash: img.hash,
    bytes: img.bytes,
  }));
  await writeJson(manifestPath, manifest);

  return { images, byRemoteUrl, broken };
}

function chooseFilename(
  remoteUrl: string,
  buffer: Buffer,
  usedNames: Set<string>,
  res: Response,
): string {
  let base = "image";
  try {
    const pathname = new URL(remoteUrl).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    if (last) base = sanitizeFilename(decodeURIComponent(last), "image");
  } catch {
    // ignore
  }

  // Infer extension if missing
  if (!/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i.test(base)) {
    const contentType = res.headers.get("content-type") ?? "";
    const ext = extFromContentType(contentType) || sniffExt(buffer) || "bin";
    base = `${base}.${ext}`;
  }

  if (!usedNames.has(base)) return base;

  const parsed = path.parse(base);
  const suffix = shortHash(buffer, 8);
  const candidate = `${parsed.name}-${suffix}${parsed.ext}`;
  if (!usedNames.has(candidate)) return candidate;

  let i = 2;
  while (usedNames.has(`${parsed.name}-${suffix}-${i}${parsed.ext}`)) i += 1;
  return `${parsed.name}-${suffix}-${i}${parsed.ext}`;
}

function extFromContentType(contentType: string): string | null {
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("svg")) return "svg";
  return null;
}

function sniffExt(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "gif";
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.toString("utf8", 0, 5).includes("<svg") || buffer.toString("utf8", 0, 100).includes("<svg")) {
    return "svg";
  }
  return null;
}

/** Stream helper kept for future large-file support */
export async function streamToFile(
  body: ReadableStream<Uint8Array>,
  filePath: string,
): Promise<void> {
  const nodeStream = Readable.fromWeb(body as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(filePath));
}
