import type { PlatformExtractor } from "../types.js";
import { genericExtractor } from "../generic/index.js";

function scoreWebflow(html: string): number {
  let score = 0;
  if (/webflow/i.test(html)) score += 0.3;
  if (/data-wf-/i.test(html)) score += 0.35;
  if (/cdn\.prod\.website-files\.com/i.test(html)) score += 0.25;
  if (/<meta[^>]+name=["']generator["'][^>]+webflow/i.test(html)) score += 0.5;
  return Math.min(score, 1);
}

/**
 * Webflow extractor — detection + generic extraction.
 * Extend with Webflow-specific DOM cleanup as needed.
 */
export const webflowExtractor: PlatformExtractor = {
  id: "webflow",
  name: "Webflow",

  detect(ctx) {
    return scoreWebflow(ctx.html);
  },

  async extractPage(ctx) {
    return genericExtractor.extractPage(ctx);
  },

  extractNavigation: genericExtractor.extractNavigation,
  extractMetadata: genericExtractor.extractMetadata,
};
