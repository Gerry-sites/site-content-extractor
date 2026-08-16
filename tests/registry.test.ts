import { describe, expect, it } from "vitest";
import { getExtractor, listExtractors, registerExtractor } from "../src/extractors/registry.js";
import type { PlatformExtractor } from "../src/extractors/types.js";
import { genericExtractor } from "../src/extractors/generic/index.js";

describe("extractor registry", () => {
  it("lists built-in extractors with generic as fallback", () => {
    const ids = listExtractors().map((e) => e.id);
    expect(ids).toContain("wix");
    expect(ids).toContain("webflow");
    expect(ids).toContain("squarespace");
    expect(ids).toContain("wordpress");
    expect(ids).toContain("generic");
    expect(ids[ids.length - 1]).toBe("generic");
  });

  it("resolves extractors by id", () => {
    expect(getExtractor("wix").name).toBe("Wix");
    expect(getExtractor("generic")).toBe(genericExtractor);
  });

  it("throws for unknown extractor ids", () => {
    expect(() => getExtractor("not-a-real-platform" as "generic")).toThrow(/No extractor/);
  });

  it("registers a custom extractor ahead of generic", () => {
    const custom: PlatformExtractor = {
      id: "ghost",
      name: "Ghost",
      detect: () => 0,
      extractPage: genericExtractor.extractPage,
    };

    registerExtractor(custom);
    const ids = listExtractors().map((e) => e.id);
    expect(ids).toContain("ghost");
    expect(ids.indexOf("ghost")).toBeLessThan(ids.indexOf("generic"));
    expect(getExtractor("ghost").name).toBe("Ghost");
  });
});
