import type { Page } from "playwright";
import type { ExtractedPage, NavigationItem, SiteMetadata } from "../types/schemas.js";
import type { PlatformId } from "../types/config.js";

export type ExtractionContext = {
  url: string;
  html: string;
  page?: Page;
  seedUrl: string;
};

export type PlatformExtractor = {
  /** Unique platform id */
  id: PlatformId;
  /** Human-readable name */
  name: string;
  /**
   * Confidence score 0–1 that this extractor matches the page/site.
   * Used by auto-detection.
   */
  detect(ctx: ExtractionContext): Promise<number> | number;
  /** Extract main content from a page */
  extractPage(ctx: ExtractionContext): Promise<ExtractedPage>;
  /** Extract site-wide navigation when possible */
  extractNavigation?(ctx: ExtractionContext): Promise<NavigationItem[]>;
  /** Extract site-wide metadata when possible */
  extractMetadata?(ctx: ExtractionContext): Promise<SiteMetadata>;
};
