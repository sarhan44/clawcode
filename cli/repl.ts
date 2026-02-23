/**
 * REPL-style shell mode: persistent clawcode> prompt, :exit, :provider, :project, :clear, :help.
 */

import { createInterface } from "node:readline";
import chalk from "chalk";
import { addRecentProject } from "./cache.js";
import { executeTaskWithSummary } from "./flow.js";
import { selectProviderUI, getCachedProvider } from "./provider.js";
import { runProjectSelection } from "./projects.js";
import { showErrorBox, showHeader } from "./ui.js";
import { readConfig } from "../config/config.js";

const REPL_PROMPT = "clawcode> ";

const COMMANDS = [
  ":exit     - Exit the shell",
  ":provider - Switch AI provider (Azure / Groq / Gemini)",
  ":project  - Change project directory",
  ":clear    - Clear screen",
  ":help     - Show this help",
];

export interface RunReplOptions {
  debug?: boolean;
}

export async function runRepl(options: RunReplOptions): Promise<void> {
  const { debug = false } = options;
  const cwd = process.cwd();

  showHeader();

  let rootDir = await runProjectSelection({ cwd, showRecent: true });
  addRecentProject(rootDir);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(REPL_PROMPT);

  const prompt = (): void => {
    rl.prompt();
  };

  let busy = false;

  const handleLine = async (line: string): Promise<void> => {
    const trimmed = line.trim();
    if (!trimmed) {
      prompt();
      return;
    }

    if (trimmed.startsWith(":")) {
      const cmd = trimmed.toLowerCase();
      if (cmd === ":exit" || cmd === ":quit" || cmd === ":q") {
        rl.close();
        process.exit(0);
      }
      if (cmd === ":provider") {
        const fileConfig = readConfig();
        const azure = fileConfig?.providers?.azure ?? null;
        const groq = fileConfig?.providers?.groq ?? null;
        const gemini = fileConfig?.providers?.gemini ?? null;
        if (!azure && !groq && !gemini) {
          showErrorBox("No LLM config found. Run clawcode to configure a provider.", debug);
        } else {
          try {
            await selectProviderUI(azure, groq, gemini, null);
            console.log(chalk.green(`Provider set to: ${getCachedProvider()}`));
          } catch (e) {
            // exit in selectProviderUI on error
          }
        }
        prompt();
        return;
      }
      if (cmd === ":project") {
        rootDir = await runProjectSelection({ cwd, initialRootDir: rootDir, showRecent: true });
        addRecentProject(rootDir);
        console.log(chalk.green("Project: " + rootDir));
        prompt();
        return;
      }
      if (cmd === ":clear") {
        console.clear();
        showHeader();
        prompt();
        return;
      }
      if (cmd === ":help" || cmd === ":h") {
        console.log(chalk.cyan("\nCommands:"));
        COMMANDS.forEach((c) => console.log("  " + c));
        console.log("");
        prompt();
        return;
      }
      console.log(chalk.yellow("Unknown command. Type :help"));
      prompt();
      return;
    }

    if (busy) {
      console.log(chalk.yellow("Task in progress. Wait for it to finish."));
      prompt();
      return;
    }

    busy = true;
    try {
      await executeTaskWithSummary({
        rootDir: rootDir,
        task: trimmed,
        yes: false,
        dryRun: false,
        providerFlag: getCachedProvider(),
        debug,
      });
      addRecentProject(rootDir);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showErrorBox(msg, debug);
    } finally {
      busy = false;
      prompt();
    }
  };

  rl.on("line", (line) => {
    handleLine(line).catch((e) => {
      showErrorBox(e instanceof Error ? e.message : String(e), debug);
      busy = false;
      prompt();
    });
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    if (busy) {
      console.log(chalk.yellow("\nInterrupted. Type :exit to quit."));
      busy = false;
      prompt();
    } else {
      console.log(chalk.gray("\nUse :exit to quit."));
      prompt();
    }
  });

  prompt();
}
