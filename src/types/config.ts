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
  concurrency: z.number().int().positive().default(3),
  timeoutMs: z.number().int().positive().default(30_000),
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
