import sharp from "sharp";
import path from "node:path";
import { ensureDir } from "../utils/fs.js";

export type ProcessedImage = {
  originalPath: string;
  thumbPath: string;
  responsivePaths: string[];
  width?: number;
  height?: number;
  format?: string;
};

/**
 * Create thumbnail (and optional responsive variants) while preserving EXIF
 * on the original file (we do not re-encode the original).
 */
export async function processImage(
  inputPath: string,
  imagesDir: string,
  options: { generateResponsive?: boolean } = {},
): Promise<ProcessedImage> {
  const thumbsDir = path.join(imagesDir, "thumbs");
  await ensureDir(thumbsDir);

  const base = path.basename(inputPath);
  const parsed = path.parse(base);
  const thumbName = `${parsed.name}-thumb.webp`;
  const thumbPath = path.join(thumbsDir, thumbName);

  const image = sharp(inputPath, { failOn: "none" });
  const meta = await image.metadata();

  await sharp(inputPath, { failOn: "none" })
    .rotate()
    .resize({
      width: 400,
      height: 400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toFile(thumbPath);

  const responsivePaths: string[] = [];
  if (options.generateResponsive) {
    const widths = [640, 1024, 1600];
    for (const width of widths) {
      if (meta.width && meta.width < width) continue;
      const outName = `${parsed.name}-w${width}.webp`;
      const outPath = path.join(imagesDir, outName);
      await sharp(inputPath, { failOn: "none" })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(outPath);
      responsivePaths.push(outPath);
    }
  }

  return {
    originalPath: inputPath,
    thumbPath,
    responsivePaths,
    width: meta.width,
    height: meta.height,
    format: meta.format,
  };
}
