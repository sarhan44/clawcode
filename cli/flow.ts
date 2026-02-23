/**
 * Single-task execution flow: provider → scan → plan → diff → apply → summary.
 */

import prompts from "prompts";
import { runAgent, applyPatches, runCommand } from "../agent/runner.js";
import type { ProviderConfig } from "../llm/provider.js";
import type { SummaryOptions } from "./ui.js";
import { readConfig } from "../config/config.js";
import { saveSessionAfterRun } from "../memory/memoryManager.js";
import { selectProviderUI, setCachedProvider, type ProviderKind } from "./provider.js";
import {
  createSpinner,
  showAnalysis,
  showDiffs,
  showFilesToEdit,
  showPatchWarnings,
  showCommands,
  showSummaryBox,
  showErrorBox,
  sectionApplyingPatches,
  sectionSuccess,
  sectionFailed,
} from "./ui.js";

export interface ExecuteTaskOptions {
  rootDir: string;
  task: string;
  dryRun?: boolean;
  yes?: boolean;
  providerFlag?: ProviderKind | null;
  debug?: boolean;
  /** When set, events are emitted and no console output (for Ink UI). */
  emitter?: import("../agent/events.js").AgentEmitter;
}

/**
 * Run one agent task: resolve provider, run agent with spinners, apply/confirm, return summary.
 */
export async function executeTask(options: ExecuteTaskOptions): Promise<SummaryOptions | null> {
  const {
    rootDir,
    task,
    dryRun = false,
    yes = false,
    providerFlag = null,
    debug = false,
    emitter,
  } = options;

  const fileConfig = readConfig();
  if (fileConfig?.defaultProvider) {
    setCachedProvider(fileConfig.defaultProvider);
  }
  const azure = fileConfig?.providers?.azure ?? null;
  const groq = fileConfig?.providers?.groq ?? null;
  const gemini = fileConfig?.providers?.gemini ?? null;
  let llm: ProviderConfig;
  try {
    llm = await selectProviderUI(azure, groq, gemini, providerFlag);
  } catch (e) {
    if (emitter) emitter.emit("error", { message: e instanceof Error ? e.message : String(e) });
    else if (debug && e instanceof Error) showErrorBox(e.message, true);
    return null;
  }

  let spinner: ReturnType<typeof createSpinner> | undefined;
  if (!emitter) spinner = createSpinner("Scanning project...").start();
  let output;
  try {
    output = await runAgent({ rootDir, task, llm, emitter });
    if (!emitter && spinner) spinner.succeed("Scan complete");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (emitter) emitter.emit("error", { message: msg });
    else {
      if (spinner) spinner.fail("Scan failed");
      showErrorBox(msg, debug);
      if (debug && e instanceof Error && e.stack) console.error(e.stack);
    }
    return null;
  }

  const { plan, patchResults, diffs, contentMap } = output;

  if (emitter && diffs.length > 0) {
    emitter.emit("diffs", { diffs });
  }

  if (!emitter) {
    showAnalysis(plan.analysis);
    showFilesToEdit(plan.files_to_edit);
    const failed = [...patchResults].filter(([, r]) => !r.applied);
    showPatchWarnings(failed);
    showDiffs(diffs);
  }

  let filesModified: string[] = [];
  const shouldApply = emitter ? yes : yes || (await prompts({
    type: "confirm",
    name: "value",
    message: "Apply these patches?",
    initial: true,
  })).value === true;

  if (diffs.length > 0 && !dryRun && shouldApply) {
    if (!emitter) sectionApplyingPatches();
    await applyPatches(rootDir, plan, contentMap, {
      onWriteFile: emitter ? (path) => emitter.emit("write_file", { path }) : undefined,
    });
    filesModified = [...new Set(plan.patches.map((p) => p.file))];
    if (!emitter) sectionSuccess();
  }

  if (plan.commands.length > 0 && !dryRun) {
    if (!emitter) showCommands(plan.commands);
    const shouldRun = emitter ? yes : yes || (await prompts({
      type: "confirm",
      name: "value",
      message: "Run these commands?",
      initial: false,
    })).value === true;
    if (shouldRun) {
      for (const cmd of plan.commands) {
        if (emitter) emitter.emit("run_tests", { command: cmd });
        try {
          await runCommand(rootDir, cmd);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (emitter) emitter.emit("error", { message: msg });
          else {
            sectionFailed();
            showErrorBox(msg, debug);
          }
          return { provider: llm.provider, filesModified, branchName: undefined, iterations: undefined };
        }
      }
    }
  }

  if (emitter) {
    emitter.emit("success", {
      filesModified,
      message:
        filesModified.length > 0
          ? `${filesModified.length} file(s) updated`
          : plan.patches.length === 0
            ? "No edits in plan"
            : "No changes applied",
    });
  }

  try {
    saveSessionAfterRun(rootDir, task, filesModified, plan.agent_notes ?? []);
  } catch {
    // ignore memory write errors
  }

  return {
    provider: llm.provider,
    filesModified,
    branchName: undefined,
    iterations: undefined,
  };
}

export function executeTaskWithSummary(options: ExecuteTaskOptions): Promise<SummaryOptions | null> {
  return executeTask(options).then((summary) => {
    if (summary) showSummaryBox(summary);
    return summary;
  });
}
