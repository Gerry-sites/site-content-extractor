import { z } from "zod";

export const CliOptionsSchema = z.object({
  url: z.string().url(),
  output: z.string().default("output"),
  depth: z.number().int().positive().default(10),
  images: z.boolean().default(true),
  markdown: z.boolean().default(true),
  verbose: z.boolean().default(false),
  headless: z.boolean().default(true),
  resume: z.boolean().default(false),
  overwrite: z.boolean().default(false),
  skipImages: z.boolean().default(false),
  skipBlog: z.boolean().default(false),
  skipPrune: z.boolean().default(false),
  platform: z
    .enum([
      "auto",
      "generic",
      "wix",
      "webflow",
      "squarespace",
      "cargo",
      "wordpress",
      "ghost",
      "framer",
      "adobe-portfolio",
    ])
    .default("auto"),
  respectRobots: z.boolean().default(true),
  concurrency: z.number().int().positive().default(2),
  timeoutMs: z.number().int().positive().default(90_000),
  settleMs: z.number().int().nonnegative().default(2_500),
  paths: z.array(z.string()).default(["/about", "/contact"]),
  generateResponsive: z.boolean().default(false),
  jsonExport: z.boolean().default(false),
  userAgent: z
    .string()
    .default(
      "site-migrate/0.1 (+https://github.com/site-migrate/site-migrate; content extraction bot)",
    ),
});

export type CliOptions = z.infer<typeof CliOptionsSchema>;

export type PlatformId =
  | "generic"
  | "wix"
  | "webflow"
  | "squarespace"
  | "cargo"
  | "wordpress"
  | "ghost"
  | "framer"
  | "adobe-portfolio";

export const ImportOptionsSchema = z.object({
  packs: z.array(z.string()).min(1),
  target: z.string().min(1),
  locale: z.string().min(1).default("en"),
  protectedPages: z.array(z.string()).default(["home", "about", "contact"]),
  overwritePages: z.boolean().default(false),
  overwriteEntries: z.boolean().default(false),
  includeFlagged: z.boolean().default(false),
  flagInlineBlog: z.boolean().default(false),
});

export type ImportOptions = z.infer<typeof ImportOptionsSchema>;

export const PruneOptionsSchema = z.object({
  packs: z.array(z.string()).min(1),
  output: z.string().default("pruned-data"),
});

export type PruneOptions = z.infer<typeof PruneOptionsSchema>;

export const VerifyGalleryOptionsSchema = z.object({
  pack: z.string().min(1),
  target: z.string().optional(),
  locale: z.string().min(1).optional(),
});

export type VerifyGalleryOptions = z.infer<typeof VerifyGalleryOptionsSchema>;
