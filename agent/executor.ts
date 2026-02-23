/**
 * Executes agent plan: backup, apply patches with diff + confirmation, run commands with confirmation.
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { AgentPlan } from "../llm/types.js";
import {
  backupFiles,
  applyPatch,
  applyPatches,
  makeReplaceDiff,
  type PatchOp,
  type PatchResult,
} from "../utils/index.js";
import type { ScannedFile } from "../utils/scanner.js";

export interface ExecutionOptions {
  rootDir: string;
  dryRun: boolean;
  confirmPatches: boolean;
  confirmCommands: boolean;
}

function getFileContentsMap(files: ScannedFile[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) m.set(f.relativePath, f.content);
  return m;
}

function collectPatchedContent(
  initial: Map<string, string>,
  patches: PatchOp[]
): Map<string, string> {
  const current = new Map(initial);
  for (const p of patches) {
    const content = current.get(p.file);
    if (content === undefined) continue;
    const result = applyPatch(content, p.find, p.replace);
    if (result.applied && result.newContent !== undefined) current.set(p.file, result.newContent);
  }
  return current;
}

export interface BuildContentMapOptions {
  onReadFile?: (relativePath: string) => void;
}

export async function buildContentMapForPlan(
  rootDir: string,
  plan: AgentPlan,
  scannedFiles: ScannedFile[],
  options?: BuildContentMapOptions
): Promise<Map<string, string>> {
  const contentMap = getFileContentsMap(scannedFiles);
  const patchPaths = [...new Set(plan.patches.map((p) => p.file))];
  const missing = patchPaths.filter((p) => !contentMap.has(p));
  if (missing.length > 0) {
    const fromDisk = await readCurrentContents(rootDir, missing, options?.onReadFile);
    for (const [k, v] of fromDisk) contentMap.set(k, v);
    for (const p of missing) {
      if (!contentMap.has(p)) contentMap.set(p, "");
    }
  }
  return contentMap;
}

export function computePatchResults(
  contentMap: Map<string, string>,
  patches: PatchOp[]
): Map<string, PatchResult> {
  return applyPatches(contentMap, patches);
}

export function buildDiffs(
  plan: AgentPlan,
  initialContent: Map<string, string>,
  patchResults: Map<string, PatchResult>
): string[] {
  const finalContent = collectPatchedContent(initialContent, plan.patches);
  const lines: string[] = [];
  for (const p of plan.patches) {
    const result = patchResults.get(p.file);
    if (result?.applied) {
      lines.push(makeReplaceDiff(p.file, p.find, p.replace));
    }
  }
  return lines;
}

export interface ApplyPlanToDiskOptions {
  onWriteFile?: (relativePath: string) => void;
}

export async function applyPlanToDisk(
  rootDir: string,
  plan: AgentPlan,
  initialContent: Map<string, string>,
  diskOptions?: ApplyPlanToDiskOptions
): Promise<void> {
  const pathsToBackup = [...new Set(plan.patches.map((p) => p.file))];
  await backupFiles(rootDir, pathsToBackup);

  const finalContent = collectPatchedContent(initialContent, plan.patches);
  for (const [relPath, content] of finalContent) {
    if (initialContent.get(relPath) === content) continue;
    diskOptions?.onWriteFile?.(relPath);
    const full = join(rootDir, relPath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  }
}

export async function readCurrentContents(
  rootDir: string,
  relativePaths: string[],
  onReadFile?: (relativePath: string) => void
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const rel of relativePaths) {
    onReadFile?.(rel);
    try {
      const content = await readFile(join(rootDir, rel), "utf-8");
      out.set(rel, content);
    } catch {
      // skip missing
    }
  }
  return out;
}
