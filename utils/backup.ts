/**
 * Backup files before editing. Uses timestamped copies in .coding-agent-backups.
 * Skips files that don't exist (e.g. new files being created).
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const BACKUP_DIR = ".coding-agent-backups";

export async function ensureBackupDir(rootDir: string): Promise<string> {
  const backupDir = join(rootDir, BACKUP_DIR);
  await mkdir(backupDir, { recursive: true });
  return backupDir;
}

export function backupPath(backupDir: string, relativePath: string): string {
  const sanitized = relativePath.replace(/\//g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return join(backupDir, `${sanitized}.${timestamp}.backup`);
}

export async function backupFile(
  rootDir: string,
  relativePath: string
): Promise<string> {
  const source = join(rootDir, relativePath);
  if (!existsSync(source)) {
    throw new Error("new file (nothing to back up)");
  }
  const backupDir = await ensureBackupDir(rootDir);
  const dest = backupPath(backupDir, relativePath);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  return dest;
}

export async function backupFiles(
  rootDir: string,
  relativePaths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await ensureBackupDir(rootDir);
  for (const rel of relativePaths) {
    try {
      const dest = await backupFile(rootDir, rel);
      out.set(rel, dest);
    } catch (e) {
      if (e instanceof Error && e.message.includes("new file")) {
        // New file being created – nothing to back up; skip silently
        continue;
      }
      console.warn(`Backup skipped for ${rel}:`, e);
    }
  }
  return out;
}
