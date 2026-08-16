import { access, mkdir, readFile, writeFile, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./hash.js";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function filesEqual(left: string, right: string): Promise<boolean> {
  if (!(await exists(left)) || !(await exists(right))) return false;
  const [a, b] = await Promise.all([readFile(left), readFile(right)]);
  return a.equals(b);
}

export async function fileSha256(filePath: string): Promise<string | undefined> {
  if (!(await exists(filePath))) return undefined;
  return sha256(await readFile(filePath));
}

export async function writeJson(filePath: string, data: unknown, pretty = true): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const body = pretty ? JSON.stringify(data, null, 2) + "\n" : JSON.stringify(data);
  await writeFile(filePath, body, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

export async function resetDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

export async function copyIfExists(from: string, to: string): Promise<boolean> {
  if (!(await exists(from))) return false;
  await ensureDir(path.dirname(to));
  await copyFile(from, to);
  return true;
}
