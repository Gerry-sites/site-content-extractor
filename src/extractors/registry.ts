import type { PlatformId } from "../types/config.js";
import type { PlatformExtractor } from "./types.js";
import { genericExtractor } from "./generic/index.js";
import { wixExtractor } from "./wix/index.js";
import { webflowExtractor } from "./webflow/index.js";
import { squarespaceExtractor } from "./squarespace/index.js";
import { wordpressExtractor } from "./wordpress/index.js";

const extractors: PlatformExtractor[] = [
  wixExtractor,
  webflowExtractor,
  squarespaceExtractor,
  wordpressExtractor,
  genericExtractor,
];

export function listExtractors(): PlatformExtractor[] {
  return [...extractors];
}

export function getExtractor(id: PlatformId): PlatformExtractor {
  const found = extractors.find((e) => e.id === id);
  if (!found) {
    throw new Error(`No extractor registered for platform: ${id}`);
  }
  return found;
}

export function registerExtractor(extractor: PlatformExtractor): void {
  const idx = extractors.findIndex((e) => e.id === extractor.id);
  if (idx >= 0) {
    extractors[idx] = extractor;
  } else {
    // Keep generic last as fallback
    const genericIdx = extractors.findIndex((e) => e.id === "generic");
    if (genericIdx >= 0) {
      extractors.splice(genericIdx, 0, extractor);
    } else {
      extractors.push(extractor);
    }
  }
}
