import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { downloadImages } from "../src/download/images.js";
import { createLogger } from "../src/utils/log.js";
import { sanitizeFilename } from "../src/utils/slug.js";
import { sha256 } from "../src/utils/hash.js";
import { upgradeMediaUrl } from "../src/media/urls.js";

describe("image downloading", () => {
  it("deduplicates identical image bytes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    // 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(png, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const result = await downloadImages(
        ["https://cdn.example.com/a/photo.png", "https://cdn.example.com/b/photo-copy.png"],
        dir,
        { skipProcess: true, concurrency: 2 },
        createLogger(false),
      );

      expect(calls).toBe(2);
      expect(result.broken).toHaveLength(0);
      // Two remote URLs map to one unique file hash
      const hashes = new Set([...result.byRemoteUrl.values()].map((v) => v.hash));
      expect(hashes.size).toBe(1);
      expect(result.images[0]?.hash).toBe(sha256(png));

      const saved = await readFile(path.join(dir, result.images[0]!.relativePath));
      expect(saved.equals(png)).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("records broken images instead of throwing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;

    try {
      const result = await downloadImages(
        ["https://cdn.example.com/missing.jpg"],
        dir,
        { skipProcess: true },
        createLogger(false),
      );
      expect(result.broken).toContain("https://cdn.example.com/missing.jpg");
      expect(result.images).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends a Referer header when downloading", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const originalFetch = globalThis.fetch;
    const headers: string[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      headers.push(h.get("referer") ?? "");
      return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
    }) as typeof fetch;
    try {
      await downloadImages(
        ["https://cdn.example.com/a.png"],
        dir,
        { skipProcess: true, referer: "https://studio.example.com/" },
        createLogger(false),
      );
      expect(headers).toContain("https://studio.example.com/");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("indexes both the original and upgraded media URLs", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const original =
      "https://static.wixstatic.com/media/ab_cd~mv2.jpg/v1/fill/w_290,h_290,al_c,q_80/ab_cd~mv2.jpg";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(png, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })) as typeof fetch;
    try {
      const result = await downloadImages(
        [original],
        dir,
        { skipProcess: true },
        createLogger(false),
      );
      const upgraded = upgradeMediaUrl(original);
      expect(upgraded).not.toBe(original);
      expect(result.byRemoteUrl.has(original)).toBe(true);
      expect(result.byRemoteUrl.has(upgraded)).toBe(true);
      expect(result.byRemoteUrl.get(original)?.relativePath).toBe(
        result.byRemoteUrl.get(upgraded)?.relativePath,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not fetch skippable Wix chrome icons", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("nope", { status: 200 });
    }) as typeof fetch;

    try {
      const result = await downloadImages(
        [
          "https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png/v1/fill/w_18,h_18,al_c,q_85/ce6ec7c11b174c0581e20f42bb865ce3.png",
        ],
        dir,
        { skipProcess: true },
        createLogger(false),
      );
      expect(calls).toBe(0);
      expect(result.images).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("filename sanitisation", () => {
  it("removes unsafe characters", () => {
    expect(sanitizeFilename('my*"file?.png')).toBe("my-file-.png");
    expect(sanitizeFilename("ok-image.webp")).toBe("ok-image.webp");
  });

  it("preserves useful basenames", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "site-migrate-"));
    await writeFile(path.join(dir, "noop"), "");
    expect(sanitizeFilename("hero-image.JPEG")).toBe("hero-image.JPEG");
  });
});
