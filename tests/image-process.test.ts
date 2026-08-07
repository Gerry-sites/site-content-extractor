import { mkdtemp, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processImage } from "../src/images/process.js";

describe("image processing", () => {
  it("creates a webp thumbnail next to the original", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-img-"));
    const imagesDir = path.join(dir, "images");
    await writeFile(path.join(dir, ".keep"), "");

    // Minimal valid 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const inputPath = path.join(imagesDir, "dot.png");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(imagesDir, { recursive: true });
    await writeFile(inputPath, png);

    const result = await processImage(inputPath, imagesDir);
    expect(result.thumbPath).toContain(`${path.sep}thumbs${path.sep}`);
    expect(result.thumbPath.endsWith("dot-thumb.webp")).toBe(true);
    await access(result.thumbPath);
    expect(result.format).toBe("png");
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});
