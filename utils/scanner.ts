/**
 * Project file scanner with .gitignore awareness.
 * Exposes minimal file list and content for context.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import ignoreModule, { type Ignore } from "ignore";

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  "*.log",
  ".env",
  ".env.*",
  "*.min.js",
  "*.min.css",
  ".DS_Store",
];

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".html", ".css", ".scss", ".less",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift",
  ".sql", ".sh", ".bash", ".yaml", ".yml", ".toml", ".ini",
  ".xml", ".svg", ".graphql", ".gql", ".vue", ".svelte",
]);

export interface ScannedFile {
  path: string;
  relativePath: string;
  content: string;
  size: number;
}

export interface ScanOptions {
  rootDir: string;
  maxFiles?: number;
  maxFileSizeBytes?: number;
  customIgnore?: string[];
  /** Called for each file read (for UI / event-driven consumers). */
  onFileRead?: (relativePath: string) => void;
}

function loadGitignore(_rootDir: string): Ignore {
  const ig = (ignoreModule as unknown as (opts?: object) => Ignore)();
  ig.add(DEFAULT_IGNORE);
  return ig;
}

async function readGitignore(rootDir: string): Promise<string | null> {
  try {
    return await readFile(join(rootDir, ".gitignore"), "utf-8");
  } catch {
    return null;
  }
}

export async function buildIgnore(rootDir: string, customIgnore: string[] = []): Promise<Ignore> {
  const ig = loadGitignore(rootDir);
  const content = await readGitignore(rootDir);
  if (content) ig.add(content);
  if (customIgnore.length > 0) ig.add(customIgnore);
  return ig;
}

function isTextFile(path: string): boolean {
  const ext = path.includes(".") ? path.slice(path.lastIndexOf(".")) : "";
  return TEXT_EXTENSIONS.has(ext.toLowerCase()) || path.endsWith("Dockerfile");
}

export async function listProjectFiles(
  rootDir: string,
  ig: Ignore,
  maxFiles: number = 500
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (results.length >= maxFiles) return;
    let entries: { name: string; isDir: boolean }[];
    try {
      entries = await readdir(dir, { withFileTypes: true }).then((e) =>
        e.map((d) => ({ name: d.name, isDir: d.isDirectory() }))
      );
    } catch {
      return;
    }
    for (const { name, isDir } of entries) {
      const full = join(dir, name);
      const rel = relative(rootDir, full);
      const normalized = rel.replace(/\\/g, "/");
      if (ig.ignores(normalized)) continue;
      if (isDir) {
        await walk(full);
      } else if (isTextFile(name)) {
        results.push(normalized);
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

export async function readFileSafe(
  rootDir: string,
  relativePath: string
): Promise<{ content: string; size: number } | null> {
  const full = join(rootDir, relativePath);
  try {
    const s = await stat(full);
    if (!s.isFile()) return null;
    const content = await readFile(full, "utf-8");
    return { content, size: s.size };
  } catch {
    return null;
  }
}

export async function scanProject(options: ScanOptions): Promise<{
  files: ScannedFile[];
  fileList: string[];
}> {
  const {
    rootDir,
    maxFiles = 500,
    maxFileSizeBytes = 200_000,
    customIgnore = [],
    onFileRead,
  } = options;

  const ig = await buildIgnore(rootDir, customIgnore);
  const fileList = await listProjectFiles(rootDir, ig, maxFiles);
  const files: ScannedFile[] = [];

  for (const rel of fileList) {
    onFileRead?.(rel);
    const data = await readFileSafe(rootDir, rel);
    if (!data || data.size > maxFileSizeBytes) continue;
    files.push({
      path: join(rootDir, rel),
      relativePath: rel,
      content: data.content,
      size: data.size,
    });
  }

  return { files, fileList };
}
