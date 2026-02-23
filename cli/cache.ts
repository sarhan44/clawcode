/**
 * Recent projects cache: ~/.clawcode/recent-projects.json (last 5).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureConfigDir, getClawCodeDir } from "../config/config.js";

const CACHE_FILE = "recent-projects.json";
const MAX_RECENT = 5;

export interface RecentProject {
  path: string;
  lastUsed: number;
}

export interface RecentProjectsCache {
  recent: RecentProject[];
}

function getCacheDir(): string {
  ensureConfigDir();
  return getClawCodeDir();
}

function getCachePath(): string {
  return join(getCacheDir(), CACHE_FILE);
}

export function readRecentProjects(): RecentProject[] {
  const path = getCachePath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as RecentProjectsCache;
    if (!Array.isArray(data.recent)) return [];
    return data.recent;
  } catch {
    return [];
  }
}

export function addRecentProject(projectPath: string): void {
  const path = getCachePath();
  let recent = readRecentProjects();
  const normalized = projectPath.replace(/\/$/, "");
  recent = recent.filter((p) => p.path !== normalized);
  recent.unshift({ path: normalized, lastUsed: Date.now() });
  recent = recent.slice(0, MAX_RECENT);
  const dir = getCacheDir();
  writeFileSync(join(dir, CACHE_FILE), JSON.stringify({ recent }, null, 2), "utf-8");
}

export function getRecentProjectsForDisplay(): { name: string; path: string }[] {
  const recent = readRecentProjects();
  return recent.map((p) => ({
    name: p.path.split("/").filter(Boolean).pop() ?? p.path,
    path: p.path,
  }));
}
