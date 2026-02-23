/**
 * Main agent orchestration: scan → select → LLM → compute patches/diffs.
 * Applying and running commands are done by the CLI after confirmation.
 * Optional emitter for event-driven UI (planning, read_file, write_file, run_tests, error, success).
 */

import { spawn } from "node:child_process";
import type { ProviderConfig } from "../llm/provider.js";
import { getStructuredPlan } from "../llm/provider.js";
import { buildSystemPrompt, buildUserPrompt } from "../llm/prompts.js";
import type { AgentPlan } from "../llm/types.js";
import type { PatchResult } from "../utils/index.js";
import { scanProject } from "../utils/scanner.js";
import {
  loadGlobalMemory,
  loadSessionMemory,
  buildMemoryContext,
} from "../memory/memoryManager.js";
import {
  buildContentMapForPlan,
  computePatchResults,
  buildDiffs,
  applyPlanToDisk,
} from "./executor.js";
import type { AgentEmitter } from "./events.js";
import { selectRelevantFiles } from "./selector.js";

export interface RunOptions {
  rootDir: string;
  task: string;
  llm: ProviderConfig;
  maxFiles?: number;
  customIgnore?: string[];
  /** When set, events are emitted for UI / event-driven consumers. */
  emitter?: AgentEmitter;
}

export interface AgentOutput {
  plan: AgentPlan;
  patchResults: Map<string, PatchResult>;
  diffs: string[];
  contentMap: Map<string, string>;
}

export async function runAgent(options: RunOptions): Promise<AgentOutput> {
  const {
    rootDir,
    task,
    llm,
    maxFiles = 500,
    customIgnore = [],
    emitter,
  } = options;

  emitter?.emit("planning", { task });

  // Don't emit read_file for every file during full scan (too noisy).
  // Only emit read_file for files actually read for the plan (in buildContentMapForPlan).
  const { files, fileList } = await scanProject({
    rootDir,
    maxFiles,
    customIgnore,
  });
  const selected = selectRelevantFiles(task, files);
  const globalMemory = loadGlobalMemory();
  const sessionMemory = loadSessionMemory(rootDir);
  const memoryContext = buildMemoryContext(rootDir, globalMemory, sessionMemory);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(task, fileList, selected, memoryContext);
  const plan = await getStructuredPlan(llm, systemPrompt, userPrompt);

  const contentMap = await buildContentMapForPlan(rootDir, plan, selected, {
    onReadFile: emitter ? (path) => emitter.emit("read_file", { path }) : undefined,
  });
  const patchResults = computePatchResults(contentMap, plan.patches);
  const diffs = buildDiffs(plan, contentMap, patchResults);

  return { plan, patchResults, diffs, contentMap };
}

export interface ApplyPatchesOptions {
  onWriteFile?: (relativePath: string) => void;
}

export async function applyPatches(
  rootDir: string,
  plan: AgentPlan,
  contentMap: Map<string, string>,
  options?: ApplyPatchesOptions
): Promise<void> {
  await applyPlanToDisk(rootDir, plan, contentMap, {
    onWriteFile: options?.onWriteFile,
  });
}

export function runCommand(cwd: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
}
