import type { PlatformExtractor } from "../types.js";
import { genericExtractor } from "../generic/index.js";

function scoreSquarespace(html: string): number {
  let score = 0;
  if (/squarespace/i.test(html)) score += 0.3;
  if (/static\.squarespace\.com/i.test(html)) score += 0.35;
  if (/sqs-/i.test(html)) score += 0.2;
  if (/<meta[^>]+name=["']generator["'][^>]+squarespace/i.test(html)) {
    score += 0.5;
  }
  return Math.min(score, 1);
}

/**
 * Squarespace extractor — detection + generic extraction.
 * Extend with Squarespace-specific DOM cleanup as needed.
 */
export const squarespaceExtractor: PlatformExtractor = {
  id: "squarespace",
  name: "Squarespace",

  detect(ctx) {
    return scoreSquarespace(ctx.html);
  },

  async extractPage(ctx) {
    return genericExtractor.extractPage(ctx);
  },

  extractNavigation: genericExtractor.extractNavigation,
  extractMetadata: genericExtractor.extractMetadata,
};
