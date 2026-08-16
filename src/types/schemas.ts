import { z } from "zod";

export type NavigationItem = {
  title: string;
  url: string;
  children?: NavigationItem[];
};

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  children: z.array(z.lazy(() => NavigationItemSchema)).optional(),
});

export const NavigationSchema = z.array(NavigationItemSchema);

export const SiteMetadataSchema = z.object({
  siteTitle: z.string().optional(),
  description: z.string().optional(),
  canonicalUrl: z.string().optional(),
  favicon: z.string().optional(),
  logo: z.string().optional(),
  language: z.string().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string(),
      }),
    )
    .default([]),
  openGraph: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      type: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  twitter: z
    .object({
      card: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      site: z.string().optional(),
    })
    .optional(),
});

export const DiscoveredPageSchema = z.object({
  url: z.string().url(),
  normalizedUrl: z.string(),
  depth: z.number().int().nonnegative(),
  source: z.enum(["seed", "navigation", "sitemap", "link", "resume"]),
  status: z.number().int().optional(),
  contentType: z.string().optional(),
  title: z.string().optional(),
});

export const PagesManifestSchema = z.object({
  seedUrl: z.string().url(),
  crawledAt: z.string(),
  pages: z.array(DiscoveredPageSchema),
});

export const ExtractedImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  mediaId: z.string().optional(),
  hash: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  role: z.enum(["content", "hero", "gallery", "logo", "favicon", "og"]).default("content"),
});

export const ExtractedLinkSchema = z.object({
  href: z.string(),
  text: z.string().optional(),
  internal: z.boolean(),
});

export const ExtractedVideoSchema = z.object({
  src: z.string(),
  provider: z.string().optional(),
  title: z.string().optional(),
});

export const ExtractedFileSchema = z.object({
  href: z.string(),
  text: z.string().optional(),
  filename: z.string().optional(),
});

export const GallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(z.string()).min(1),
});

export const BlogPostMetaSchema = z.object({
  title: z.string(),
  date: z.string().optional(),
  author: z.string().optional(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  heroImage: z.string().optional(),
  slug: z.string().optional(),
});

export const ExtractedPageSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  slug: z.string(),
  date: z.string().optional(),
  headings: z.array(z.string()).default([]),
  htmlContent: z.string(),
  textContent: z.string().optional(),
  heroImage: z.string().optional(),
  images: z.array(ExtractedImageSchema).default([]),
  links: z.array(ExtractedLinkSchema).default([]),
  videos: z.array(ExtractedVideoSchema).default([]),
  files: z.array(ExtractedFileSchema).default([]),
  galleries: z.array(GallerySchema).default([]),
  isBlogPost: z.boolean().default(false),
  blog: BlogPostMetaSchema.optional(),
  kind: z.enum(["page", "blog", "portfolio", "gallery"]).default("page"),
});

export const FrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().min(1),
  heroImage: z.string().optional(),
  heroTitle: z.string().optional(),
  heroCaption: z.string().optional(),
  heroMediaId: z.string().optional(),
  heroHash: z.string().optional(),
  date: z.string().optional(),
  author: z.string().optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  gallery: z
    .array(
      z.union([
        z.string(),
        z.object({
          src: z.string(),
          title: z.string().optional(),
          caption: z.string().optional(),
          mediaId: z.string().optional(),
          hash: z.string().optional(),
        }),
      ]),
    )
    .optional(),
  draft: z.boolean().optional(),
  sourceUrl: z.string().optional(),
});

export const MigrationReportSchema = z.object({
  seedUrl: z.string(),
  platform: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  pages: z.number().int().nonnegative(),
  blogPosts: z.number().int().nonnegative(),
  images: z.number().int().nonnegative(),
  galleries: z.number().int().nonnegative(),
  brokenImages: z.array(z.string()).default([]),
  brokenLinks: z.array(z.string()).default([]),
  missingMetadata: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  coverage: z
    .object({
      discovered: z.number().int().nonnegative(),
      withHtml: z.number().int().nonnegative(),
      htmlExpected: z.number().int().nonnegative().optional(),
      missingHtml: z.array(z.string()).default([]),
      missingMarkdown: z.array(z.string()).default([]),
      missingImages: z.array(z.string()).default([]),
      leftoverRemote: z.array(z.string()).default([]),
      seedMissing: z
        .array(z.object({ path: z.string(), status: z.number().optional() }))
        .default([]),
    })
    .optional(),
});

export type SiteMetadata = z.infer<typeof SiteMetadataSchema>;
export type DiscoveredPage = z.infer<typeof DiscoveredPageSchema>;
export type PagesManifest = z.infer<typeof PagesManifestSchema>;
export type ExtractedImage = z.infer<typeof ExtractedImageSchema>;
export type ExtractedLink = z.infer<typeof ExtractedLinkSchema>;
export type ExtractedVideo = z.infer<typeof ExtractedVideoSchema>;
export type ExtractedFile = z.infer<typeof ExtractedFileSchema>;
export type Gallery = z.infer<typeof GallerySchema>;
export type BlogPostMeta = z.infer<typeof BlogPostMetaSchema>;
export type ExtractedPage = z.infer<typeof ExtractedPageSchema>;
export type Frontmatter = z.infer<typeof FrontmatterSchema>;
export type MigrationReport = z.infer<typeof MigrationReportSchema>;
