import { describe, expect, it } from "vitest";
import {
  isOtherHost,
  isSkippableAsset,
  upgradeMediaUrl,
  upgradeWixUrl,
  wixMediaId,
  wordpressOriginalUrl,
} from "../src/media/urls.js";

const WIX_THUMB =
  "https://static.wixstatic.com/media/bfe860_0d0b5336d5cf49f8930f57ebbcc619af~mv2.jpg/v1/fill/w_317,h_357,al_c,q_80,enc_avif,quality_auto/bfe860_0d0b5336d5cf49f8930f57ebbcc619af~mv2.jpg";

const WIX_ICON =
  "https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png/v1/fill/w_18,h_18,al_c,q_85/ce6ec7c11b174c0581e20f42bb865ce3.png";

const WP_THUMB =
  "https://i0.wp.com/blog.example.com/wp-content/uploads/2020/01/dish.jpg?w=300&h=300&crop=1";

describe("Wix media URLs", () => {
  it("upgrades cropped Wix thumbs to a fit JPEG large enough for a hero", () => {
    const upgraded = upgradeWixUrl(WIX_THUMB);
    expect(upgraded).toContain("/v1/fit/w_1800,h_1800");
    expect(upgraded).toContain("enc_jpg");
    expect(upgraded).not.toContain("w_317");
    expect(wixMediaId(WIX_THUMB)).toBe("bfe860_0d0b5336d5cf49f8930f57ebbcc619af~mv2.jpg");
  });

  it("rewrites /v1/fill/ even when the filename is not a Wix media id", () => {
    const cropped =
      "https://static.wixstatic.com/media/photo.jpg/v1/fill/w_290,h_290,al_c,q_80,enc_auto/photo.jpg";
    const upgraded = upgradeWixUrl(cropped);
    expect(upgraded).toContain("/v1/fit/w_1800,h_1800");
    expect(upgraded).not.toMatch(/\/v1\/fill\/w_\d+/);
  });

  it("fails if upgradeMediaUrl leaves a cropped Wix thumb as-is", () => {
    const upgraded = upgradeMediaUrl(WIX_THUMB);
    expect(upgraded).not.toBe(WIX_THUMB);
    expect(upgraded).not.toMatch(/\/v1\/fill\/w_\d+/);
  });

  it("skips Wix chrome icons and data URIs, not artwork thumbs", () => {
    expect(isSkippableAsset(WIX_ICON)).toBe(true);
    expect(isSkippableAsset("data:image/svg+xml;base64,PHN2Zy")).toBe(true);
    expect(
      isSkippableAsset("https://static.wixstatic.com/media/ce6ec7c11b174c0581e20f42bb865ce3.png"),
    ).toBe(true);
    expect(isSkippableAsset(WIX_THUMB)).toBe(false);
  });
});

describe("WordPress media URLs", () => {
  it("strips size and crop query strings so originals download", () => {
    const original = wordpressOriginalUrl(WP_THUMB);
    expect(original).not.toMatch(/[?&]w=/);
    expect(original).not.toMatch(/crop=/);
    expect(original).toContain("dish.jpg");
    expect(upgradeMediaUrl(WP_THUMB)).toBe(original);
  });

  it("leaves already-original WordPress URLs unchanged", () => {
    const url = "https://blog.example.com/wp-content/uploads/2020/01/dish.jpg";
    expect(wordpressOriginalUrl(url)).toBe(url);
  });
});

describe("other-host detection", () => {
  it("treats the seed origin and platform CDNs as first-party", () => {
    expect(
      isOtherHost("https://blog.example.com/wp-content/uploads/a.jpg", "https://blog.example.com/"),
    ).toBe(false);
    expect(
      isOtherHost("https://static.wixstatic.com/media/photo.jpg", "https://studio.example.com/"),
    ).toBe(false);
    expect(isOtherHost("https://cdn.other.example/x.jpg", "https://blog.example.com/")).toBe(true);
  });
});
