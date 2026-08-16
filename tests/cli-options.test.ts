import { describe, expect, it } from "vitest";
import { CliOptionsSchema } from "../src/types/config.js";

describe("CLI options schema", () => {
  it("applies defaults for a valid URL", () => {
    const parsed = CliOptionsSchema.parse({
      url: "https://example.com",
    });

    expect(parsed.output).toBe("output");
    expect(parsed.depth).toBe(10);
    expect(parsed.platform).toBe("auto");
    expect(parsed.headless).toBe(true);
    expect(parsed.respectRobots).toBe(true);
    expect(parsed.concurrency).toBe(2);
    expect(parsed.timeoutMs).toBe(90_000);
    expect(parsed.settleMs).toBe(2_500);
    expect(parsed.paths).toEqual(["/about", "/contact"]);
    expect(parsed.skipImages).toBe(false);
  });

  it("rejects invalid URLs", () => {
    const result = CliOptionsSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown platforms", () => {
    const result = CliOptionsSchema.safeParse({
      url: "https://example.com",
      platform: "myspace",
    });
    expect(result.success).toBe(false);
  });

  it("accepts supported platform overrides", () => {
    for (const platform of ["wix", "webflow", "squarespace", "generic", "wordpress"] as const) {
      const parsed = CliOptionsSchema.parse({
        url: "https://example.com",
        platform,
        depth: 2,
        overwrite: true,
      });
      expect(parsed.platform).toBe(platform);
      expect(parsed.depth).toBe(2);
      expect(parsed.overwrite).toBe(true);
    }
  });

  it("rejects non-positive depth and concurrency", () => {
    expect(
      CliOptionsSchema.safeParse({
        url: "https://example.com",
        depth: 0,
      }).success,
    ).toBe(false);
    expect(
      CliOptionsSchema.safeParse({
        url: "https://example.com",
        concurrency: -1,
      }).success,
    ).toBe(false);
  });
});
