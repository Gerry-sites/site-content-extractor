import { createHash } from "node:crypto";

export function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function shortHash(buffer: Buffer | string, length = 12): string {
  return sha256(buffer).slice(0, length);
}
