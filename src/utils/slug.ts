import slugify from "slugify";

export function toSlug(input: string, fallback = "page"): string {
  const cleaned = input
    .replace(/\\/g, "/")
    .replace(/\.[a-z0-9]+$/i, "")
    .trim();

  const slug = slugify(cleaned, {
    lower: true,
    strict: true,
    trim: true,
  });

  return slug || fallback;
}

export function uniqueSlug(base: string, used: Set<string>): string {
  let candidate = toSlug(base);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let i = 2;
  while (used.has(`${candidate}-${i}`)) {
    i += 1;
  }
  const unique = `${candidate}-${i}`;
  used.add(unique);
  return unique;
}

export function sanitizeFilename(input: string, fallback = "file"): string {
  let base = input.split(/[\\/]/).pop() ?? input;

  // Strip URL query/hash only when it looks like a real query string
  // (e.g. photo.jpg?width=400), not when "?" is an unsafe filename char.
  if (/[?&][^=\s]+=/.test(base)) {
    base = base.split("?")[0] ?? base;
  }
  base = base.split("#")[0] ?? base;

  const sanitized = base
    .replace(/[<>:"|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+$/g, "")
    .slice(0, 180);

  return sanitized || fallback;
}
