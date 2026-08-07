import type { PlatformId } from "../types/config.js";
import type { ExtractionContext } from "../extractors/types.js";
import { listExtractors } from "../extractors/registry.js";

export type DetectionResult = {
  platform: PlatformId;
  name: string;
  confidence: number;
  scores: Array<{ id: PlatformId; name: string; score: number }>;
};

/**
 * Auto-detect the website platform from HTML/URL signals.
 * Falls back to `generic` when confidence is low.
 */
export async function detectPlatform(
  ctx: ExtractionContext,
  minimumConfidence = 0.35,
): Promise<DetectionResult> {
  const extractors = listExtractors().filter((e) => e.id !== "generic");
  const scores: DetectionResult["scores"] = [];

  for (const extractor of extractors) {
    const score = await extractor.detect(ctx);
    scores.push({ id: extractor.id, name: extractor.name, score });
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score < minimumConfidence) {
    return {
      platform: "generic",
      name: "Generic HTML",
      confidence: best?.score ?? 0,
      scores: [
        ...scores,
        { id: "generic", name: "Generic HTML", score: 0.1 },
      ],
    };
  }

  return {
    platform: best.id,
    name: best.name,
    confidence: best.score,
    scores,
  };
}
