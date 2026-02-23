/**
 * ClawCode config: read/write ~/.clawcode/config.json.
 * Cross-platform path handling via node:path and node:os homedir().
 * Migrates from ~/.helix if present. No plaintext logging of credentials.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { ClawCodeConfig } from "./types.js";
import { isClawCodeConfig } from "./types.js";

const CLAWCODE_DIR = ".clawcode";
const HELIX_DIR_LEGACY = ".helix";
const CONFIG_FILE = "config.json";
const MEMORY_DIR = "memory";
const SESSIONS_DIR = "sessions";

/**
 * Returns the ClawCode config directory (e.g. ~/.clawcode or C:\Users\you\.clawcode).
 */
export function getClawCodeDir(): string {
  const home = homedir();
  if (!home) {
    throw new Error("Could not resolve home directory");
  }
  return join(home, CLAWCODE_DIR);
}

function getHelixDirLegacy(): string {
  const home = homedir();
  if (!home) throw new Error("Could not resolve home directory");
  return join(home, HELIX_DIR_LEGACY);
}

/**
 * If ~/.helix exists and ~/.clawcode does not, move config and memory files and print migration message.
 */
export function migrateFromHelixIfNeeded(): boolean {
  const legacyDir = getHelixDirLegacy();
  const newDir = getClawCodeDir();
  if (!existsSync(legacyDir) || existsSync(newDir)) return false;

  mkdirSync(newDir, { recursive: true });
  let migrated = false;

  const legacyConfig = join(legacyDir, CONFIG_FILE);
  if (existsSync(legacyConfig)) {
    try {
      const target = join(newDir, CONFIG_FILE);
      copyFileSync(legacyConfig, target);
      migrated = true;
    } catch {
      // ignore
    }
  }

  const legacyRecent = join(legacyDir, "recent-projects.json");
  if (existsSync(legacyRecent)) {
    try {
      const target = join(newDir, "recent-projects.json");
      copyFileSync(legacyRecent, target);
      migrated = true;
    } catch {
      // ignore
    }
  }

  const legacyMemory = join(legacyDir, MEMORY_DIR);
  if (existsSync(legacyMemory)) {
    const targetMemory = join(newDir, MEMORY_DIR);
    mkdirSync(targetMemory, { recursive: true });
    try {
      const globalPath = join(legacyMemory, "global.json");
      if (existsSync(globalPath)) {
        copyFileSync(globalPath, join(targetMemory, "global.json"));
        migrated = true;
      }
    } catch {
      // ignore
    }
    const legacySessions = join(legacyMemory, SESSIONS_DIR);
    if (existsSync(legacySessions)) {
      const targetSessions = join(targetMemory, SESSIONS_DIR);
      mkdirSync(targetSessions, { recursive: true });
      try {
        for (const name of readdirSync(legacySessions)) {
          const src = join(legacySessions, name);
          const dest = join(targetSessions, name);
          if (name.endsWith(".json")) copyFileSync(src, dest);
        }
        migrated = true;
      } catch {
        // ignore
      }
    }
  }

  if (migrated) {
    console.log("Migrated Helix config to ClawCode.");
  }
  return migrated;
}

/**
 * Returns the full path to config.json.
 */
export function getConfigPath(): string {
  return join(getClawCodeDir(), CONFIG_FILE);
}

/**
 * Ensures ~/.clawcode exists. Creates it if needed. Runs migration first if applicable.
 */
export function ensureConfigDir(): void {
  migrateFromHelixIfNeeded();
  const dir = getClawCodeDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Reads config from disk. Returns null if missing or invalid.
 */
export function readConfig(): ClawCodeConfig | null {
  ensureConfigDir();
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (!isClawCodeConfig(data)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Writes config to disk. Overwrites existing. Ensures directory exists.
 */
export function writeConfig(config: ClawCodeConfig): void {
  ensureConfigDir();
  const path = getConfigPath();
  writeFileSync(path, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Returns true if config exists and has at least one provider configured.
 */
export function hasProviders(config: ClawCodeConfig | null): boolean {
  if (!config?.providers || typeof config.providers !== "object") return false;
  const p = config.providers;
  return !!(p.azure || p.groq || p.gemini);
}

/** Used only for tests / platform checks; never log paths that contain secrets. */
export function getPlatform(): string {
  return platform();
}

/** @deprecated Use getClawCodeDir. Kept for backward compatibility during rebrand. */
export function getHelixDir(): string {
  return getClawCodeDir();
}
