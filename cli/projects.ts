/**
 * Interactive directory selection using @inquirer/prompts.
 * Lists directories from cwd, arrow-key navigation, Enter to select.
 * Options: "Use current directory", subdirs, "Enter custom path".
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { input as inquirerInput, select } from "@inquirer/prompts";
import { getRecentProjectsForDisplay } from "./cache.js";

const USE_CURRENT_DIR = "Use current directory";
const ENTER_CUSTOM_PATH = "Enter custom path";
const CUSTOM_PATH_VALUE = "__CLAWCODE_CUSTOM_PATH__";

/**
 * Returns choices for directory selection: current dir, then all subdirs of cwd, then custom path.
 * Cross-platform: uses node:path join/resolve.
 */
function getDirectoryChoices(cwd: string): { name: string; value: string }[] {
  const choices: { name: string; value: string }[] = [
    { name: USE_CURRENT_DIR, value: cwd },
  ];

  try {
    const entries = readdirSync(cwd, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: join(cwd, d.name) }));
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    for (const { name, path: dirPath } of entries) {
      choices.push({ name, value: dirPath });
    }
  } catch {
    // e.g. permission denied reading cwd
  }

  choices.push({ name: ENTER_CUSTOM_PATH, value: CUSTOM_PATH_VALUE });
  return choices;
}

export interface RunProjectSelectionOptions {
  cwd: string;
  initialRootDir?: string;
  showRecent?: boolean;
}

/**
 * Run interactive directory selection.
 * Arrow keys to move, Enter to select. First option: use current directory; last: enter custom path.
 */
export async function runProjectSelection(options: RunProjectSelectionOptions): Promise<string> {
  const { cwd, initialRootDir, showRecent = true } = options;
  const recent = showRecent ? getRecentProjectsForDisplay() : [];
  const dirChoices = getDirectoryChoices(cwd);

  const choices: { name: string; value: string }[] = [];
  if (recent.length > 0) {
    for (const p of recent) {
      choices.push({ name: `${p.name} ${chalk.gray("(recent)")}`, value: resolve(p.path) });
    }
  }
  for (const c of dirChoices) {
    choices.push(c);
  }

  const resolvedInitial = initialRootDir ? resolve(initialRootDir) : undefined;
  const defaultVal =
    resolvedInitial && choices.some((c) => c.value === resolvedInitial)
      ? resolvedInitial
      : choices[0]?.value ?? cwd;

  let selected = await select({
    message: "Select project directory",
    choices,
    default: defaultVal,
    loop: true,
    pageSize: 12,
  });

  if (selected === CUSTOM_PATH_VALUE) {
    selected = await inquirerInput({
      message: "Enter project directory path",
      default: cwd,
      validate: (value) => {
        const path = resolve((value ?? "").trim() || ".");
        if (!existsSync(path)) return "Path does not exist.";
        if (!statSync(path).isDirectory()) return "Path is not a directory.";
        return true;
      },
    });
    selected = resolve((selected ?? "").trim() || ".");
  }

  return resolve(selected);
}
