import type { ExtractedPage } from "../types/schemas.js";

/**
 * Optional post-extraction transformers.
 * Platform extractors should do most cleanup; use this layer for
 * cross-cutting concerns (AI cleanup hooks, link rewriting, etc.).
 */
export type PageTransformer = (page: ExtractedPage) => ExtractedPage | Promise<ExtractedPage>;

export async function applyTransformers(
  page: ExtractedPage,
  transformers: PageTransformer[],
): Promise<ExtractedPage> {
  let current = page;
  for (const transform of transformers) {
    current = await transform(current);
  }
  return current;
}
