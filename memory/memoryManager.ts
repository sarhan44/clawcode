/**
 * Persistent context memory: global (project summaries) and per-project session.
 * Survives CLI restarts, REPL sessions, and model switching. Model-agnostic.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureConfigDir, getClawCodeDir } from "../config/config.js";
import { getProjectHash } from "./projectHasher.js";

const MEMORY_DIR = "memory";
const GLOBAL_FILE = "global.json";
const SESSIONS_DIR = "sessions";

const MAX_LAST_TASKS = 10;
const MAX_RECENT_FILES = 30;
const MAX_AGENT_NOTES = 20;

export interface ProjectSummary {
  framework: string;
  testCommand: string;
  architecture: string;
}

export interface GlobalMemory {
  projectSummaries: Record<string, ProjectSummary>;
}

export interface SessionMemory {
  lastTasks: string[];
  recentFiles: string[];
  agentNotes: string[];
}

const DEFAULT_GLOBAL: GlobalMemory = { projectSummaries: {} };
const DEFAULT_SESSION: SessionMemory = {
  lastTasks: [],
  recentFiles: [],
  agentNotes: [],
};

function safeParseJson<T>(path: string, defaultValue: T): T {
  if (!existsSync(path)) return defaultValue;
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    return data as T;
  } catch {
    return defaultValue;
  }
}

function ensureMemoryDirs(): void {
  ensureConfigDir();
  const base = getClawCodeDir();
  const memoryDir = join(base, MEMORY_DIR);
  const sessionsDir = join(memoryDir, SESSIONS_DIR);
  if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
}

function getGlobalPath(): string {
  ensureMemoryDirs();
  return join(getClawCodeDir(), MEMORY_DIR, GLOBAL_FILE);
}

function getSessionPath(projectHash: string): string {
  ensureMemoryDirs();
  return join(getClawCodeDir(), MEMORY_DIR, SESSIONS_DIR, `${projectHash}.json`);
}

function capArray<T>(arr: T[], max: number): T[] {
  return arr.slice(0, max);
}

function isGlobalMemory(value: unknown): value is GlobalMemory {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (!o.projectSummaries || typeof o.projectSummaries !== "object") return false;
  return true;
}

function isSessionMemory(value: unknown): value is SessionMemory {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (!Array.isArray(o.lastTasks)) return false;
  if (!Array.isArray(o.recentFiles)) return false;
  if (!Array.isArray(o.agentNotes)) return false;
  return true;
}

/**
 * Load global memory from ~/.clawcode/memory/global.json.
 */
export function loadGlobalMemory(): GlobalMemory {
  const path = getGlobalPath();
  const data = safeParseJson(path, DEFAULT_GLOBAL);
  if (!isGlobalMemory(data)) return DEFAULT_GLOBAL;
  return data;
}

/**
 * Load session memory for the given project root.
 */
export function loadSessionMemory(projectRoot: string): SessionMemory {
  const hash = getProjectHash(projectRoot);
  const path = getSessionPath(hash);
  const data = safeParseJson(path, DEFAULT_SESSION);
  if (!isSessionMemory(data)) return { ...DEFAULT_SESSION };
  return {
    lastTasks: capArray(data.lastTasks, MAX_LAST_TASKS),
    recentFiles: capArray(data.recentFiles, MAX_RECENT_FILES),
    agentNotes: capArray(data.agentNotes, MAX_AGENT_NOTES),
  };
}

/**
 * Build a string to inject into the prompt context from global + session memory.
 */
export function buildMemoryContext(
  projectRoot: string,
  globalMemory: GlobalMemory,
  sessionMemory: SessionMemory
): string {
  const parts: string[] = [];
  const summary = globalMemory.projectSummaries[projectRoot];
  if (summary) {
    parts.push(
      `Project context: framework=${summary.framework}, testCommand=${summary.testCommand}, architecture=${summary.architecture}`
    );
  }
  if (sessionMemory.lastTasks.length > 0) {
    parts.push(
      `Recent tasks in this project: ${sessionMemory.lastTasks.slice(0, 5).join("; ")}`
    );
  }
  if (sessionMemory.recentFiles.length > 0) {
    parts.push(
      `Recently touched files: ${sessionMemory.recentFiles.slice(0, 10).join(", ")}`
    );
  }
  if (sessionMemory.agentNotes.length > 0) {
    parts.push(
      `Agent notes: ${sessionMemory.agentNotes.slice(0, 5).join("; ")}`
    );
  }
  if (parts.length === 0) return "";
  return "\n\n[Context memory]\n" + parts.join("\n") + "\n";
}

/**
 * Persist session state after a successful run.
 * Appends task to lastTasks (capped), merges recentFiles, appends agentNotes if provided.
 */
export function saveSessionAfterRun(
  projectRoot: string,
  task: string,
  filesTouched: string[],
  agentNotes: string[] = []
): void {
  const hash = getProjectHash(projectRoot);
  const session = loadSessionMemory(projectRoot);

  const lastTasks = [task, ...session.lastTasks.filter((t) => t !== task)];
  const recentFiles = [
    ...new Set([...filesTouched, ...session.recentFiles].slice(0, MAX_RECENT_FILES)),
  ];
  const notes = agentNotes.length > 0
    ? capArray([...agentNotes, ...session.agentNotes], MAX_AGENT_NOTES)
    : session.agentNotes;

  const updated: SessionMemory = {
    lastTasks: capArray(lastTasks, MAX_LAST_TASKS),
    recentFiles,
    agentNotes: notes,
  };

  const path = getSessionPath(hash);
  writeFileSync(path, JSON.stringify(updated, null, 2), "utf-8");
}

/**
 * Update global project summary for a project (optional; can be called from CLI or agent).
 */
export function saveProjectSummary(
  projectRoot: string,
  summary: Partial<ProjectSummary>
): void {
  const path = getGlobalPath();
  const global = loadGlobalMemory();
  const existing = global.projectSummaries[projectRoot] ?? {
    framework: "",
    testCommand: "",
    architecture: "",
  };
  global.projectSummaries[projectRoot] = { ...existing, ...summary };
  writeFileSync(path, JSON.stringify(global, null, 2), "utf-8");
}
