#!/usr/bin/env node
/**
 * ClawCode CLI – AI coding agent.
 *   clawcode              → interactive (project + task)
 *   clawcode shell        → REPL mode
 *   clawcode "task"       → single task in cwd
 *   clawcode --dir /path "task"
 *   [--dry-run] [--yes] [--provider azure|groq|gemini] [--debug] [--version]
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { input as inquirerInput } from "@inquirer/prompts";
import { createAgentEmitter } from "./agent/events.js";
import { addRecentProject } from "./cli/cache.js";
import { executeTask, executeTaskWithSummary } from "./cli/flow.js";
import { readConfig } from "./config/config.js";
import { runOnboardingIfNeeded, runProviderConfig } from "./cli/onboarding.js";
import { getCachedProvider, selectProviderUI, type ProviderKind } from "./cli/provider.js";
import { runProjectSelection } from "./cli/projects.js";
import { runRepl } from "./cli/repl.js";
import { showErrorBox, showHeader } from "./cli/ui.js";
import { runInkUI } from "./ui/run-ui.js";

const DEFAULT_ROOT = process.cwd();
const PROVIDERS = ["azure", "groq", "gemini"] as const;
type ProviderFlag = (typeof PROVIDERS)[number];

const CLI_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(CLI_DIR, "..");

function getGitBranch(projectRoot: string): string | undefined {
  try {
    const res = spawnSync("git", ["-C", projectRoot, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (res.status !== 0) return undefined;
    const branch = String(res.stdout ?? "").trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

export interface ParsedArgs {
  task: string;
  rootDir: string;
  dryRun: boolean;
  yes: boolean;
  provider: ProviderFlag | null;
  explicitDir: boolean;
  debug: boolean;
  version: boolean;
  shell: boolean;
  ui: boolean;
  help: boolean;
}

function showHelp(): void {
  console.log(`
ClawCode – AI coding agent

USAGE
  clawcode                    Open interactive UI (default)
  clawcode shell              REPL mode (persistent prompt)
  clawcode --ui               Interactive UI mode (same as default)
  clawcode "task"             Run task in current directory (no UI)
  clawcode --dir <path> "task"  Run task in specified directory

COMMANDS
  config                      Configure AI providers (add/update API keys)
  shell                       Start REPL with clawcode> prompt
  --ui                        Start interactive terminal UI

OPTIONS
  --dir <path>                Project root directory (default: cwd)
  --dry-run                   Preview changes only (no writes, no commands)
  --yes, -y                   Skip confirmation prompts (apply patches, run commands)
  --provider <name>           Force AI provider: azure | groq | gemini
  --debug                     Show detailed errors
  --version, -v               Print version
  --help, -h                  Show this help

REPL COMMANDS (when running clawcode shell)
  :exit, :quit, :q            Exit the shell
  :provider                   Switch AI provider
  :project                    Change project directory
  :clear                      Clear screen
  :help, :h                   Show REPL help

EXAMPLES
  clawcode config             Add or update AI provider (Azure, Groq, Gemini)
  clawcode "Add unit tests for auth module"
  clawcode --dir ./my-app "Fix typo in README"
  clawcode --provider groq "Refactor login" --yes
  clawcode --dry-run "Add error handling"
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  let task = "";
  let rootDir = DEFAULT_ROOT;
  let dryRun = false;
  let yes = false;
  let provider: ProviderFlag | null = null;
  let explicitDir = false;
  let debug = false;
  let version = false;
  let shell = false;
  let ui = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) {
      rootDir = resolve(argv[++i]);
      explicitDir = true;
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    } else if (argv[i] === "--yes" || argv[i] === "-y") {
      yes = true;
    } else if (argv[i] === "--provider" && argv[i + 1]) {
      const p = argv[++i].toLowerCase();
      if (p === "azure" || p === "groq" || p === "gemini") provider = p;
    } else if (argv[i] === "--debug") {
      debug = true;
    } else if (argv[i] === "--version" || argv[i] === "-v") {
      version = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      help = true;
    } else if (argv[i] === "shell") {
      shell = true;
    } else if (argv[i] === "--ui") {
      ui = true;
    } else if (argv[i].startsWith("--")) {
      // skip
    } else {
      task = argv[i];
    }
  }
  return { task, rootDir, dryRun, yes, provider, explicitDir, debug, version, shell, ui, help };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { task, rootDir, dryRun, yes, provider: providerFlag, explicitDir, debug, version, shell, ui, help } = parseArgs(argv);

  if (help) {
    showHelp();
    process.exit(0);
  }

  if (argv[0] === "config") {
    await runProviderConfig();
    process.exit(0);
  }

  if (version) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf-8")) as { version?: string };
      console.log(pkg.version ?? "1.0.0");
    } catch {
      console.log("1.0.0");
    }
    process.exit(0);
  }

  await runOnboardingIfNeeded();

  if (shell && !ui) {
    await runRepl({ debug });
    return;
  }

  // Default: open UI when no task is provided (or when --ui / shell is set).
  if (ui || shell || !task) {
    showHeader();
    let uiRootDir = explicitDir ? resolve(rootDir) : await runProjectSelection({
      cwd: DEFAULT_ROOT,
      initialRootDir: resolve(rootDir),
      showRecent: true,
    });
    uiRootDir = resolve(uiRootDir);
    addRecentProject(uiRootDir);
    const fileConfig = readConfig();
    const azure = fileConfig?.providers?.azure ?? null;
    const groq = fileConfig?.providers?.groq ?? null;
    const gemini = fileConfig?.providers?.gemini ?? null;
    await selectProviderUI(azure, groq, gemini, providerFlag);
    const providerName = getCachedProvider() ?? "groq";
    const modelName =
      providerName === "groq"
        ? (groq?.model ?? "openai/gpt-oss-120b")
        : providerName === "azure"
          ? (azure?.deployment ?? "gpt-4o")
          : providerName === "gemini"
            ? (gemini?.model ?? "gemini-2.0-flash")
            : providerName;
    const branch = getGitBranch(uiRootDir);
    const emitter = createAgentEmitter();
    const runTask = async (params: {
      rootDir: string;
      task: string;
      emitter: import("./agent/events.js").AgentEmitter;
    }) => {
      await executeTask({
        rootDir: params.rootDir,
        task: params.task,
        emitter: params.emitter,
        yes: true,
        providerFlag: getCachedProvider(),
      });
    };
    await runInkUI({
      rootDir: uiRootDir,
      provider: providerName,
      model: modelName,
      branch,
      emitter,
      runTask,
    });
    return;
  }

  showHeader();

  const isInteractive = !task;
  let currentRootDir = rootDir;
  let currentTask = task;

  if (isInteractive) {
    if (!explicitDir) {
      currentRootDir = resolve(
        await runProjectSelection({
          cwd: DEFAULT_ROOT,
          initialRootDir: resolve(rootDir),
          showRecent: true,
        })
      );
      addRecentProject(currentRootDir);
    } else {
      currentRootDir = resolve(currentRootDir);
    }
    currentTask = await inquirerInput({
      message: "What would you like ClawCode to do?",
      validate: (value) => (value.trim() ? true : "Please enter a task."),
    });
    currentTask = currentTask.trim();
    if (!currentTask) {
      showErrorBox("No task provided.");
      process.exit(1);
    }
  } else {
    currentRootDir = resolve(currentRootDir);
  }

  do {
    try {
      const summary = await executeTaskWithSummary({
        rootDir: currentRootDir,
        task: currentTask,
        dryRun,
        yes,
        providerFlag: (providerFlag ?? getCachedProvider()) as ProviderKind | null,
        debug,
      });
      if (summary) addRecentProject(currentRootDir);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showErrorBox(msg, debug);
      if (!isInteractive) process.exit(1);
    }
    try {
      const nextTask = await inquirerInput({
        message: "What would you like ClawCode to do next? (leave empty to exit)",
        default: "",
      });
      currentTask = nextTask.trim();
    } catch {
      currentTask = "";
    }
  } while (currentTask);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  showErrorBox(msg, process.argv.includes("--debug"));
  if (process.argv.includes("--debug") && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
