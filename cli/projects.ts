/**
 * Project directory selection: recent projects + browse (current dir, subdirs, other).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { input as inquirerInput, select } from "@inquirer/prompts";
import { getRecentProjectsForDisplay } from "./cache.js";

const PROJECT_MARKERS = ["package.json", ".git", "pyproject.toml", "go.mod"] as const;
const OTHER_DIR_CHOICE = "__HELIX_OTHER_DIR__";

function getProjectDirectoryChoices(cwd: string): { name: string; value: string }[] {
  const choices: { name: string; value: string }[] = [
    { name: ". (current directory)", value: cwd },
  ];
  try {
    const entries = readdirSync(cwd, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => ({ name: d.name, path: join(cwd, d.name) }));
    for (const { name, path: dirPath } of entries) {
      const hasMarker = PROJECT_MARKERS.some((m) => existsSync(join(dirPath, m)));
      if (hasMarker) choices.push({ name, value: dirPath });
    }
  } catch {
    // ignore
  }
  choices.push({ name: "Other (enter path)", value: OTHER_DIR_CHOICE });
  return choices;
}

export interface RunProjectSelectionOptions {
  cwd: string;
  initialRootDir?: string;
  showRecent?: boolean;
}

/**
 * Run interactive project selection. Optionally show recent projects first.
 */
export async function runProjectSelection(options: RunProjectSelectionOptions): Promise<string> {
  const { cwd, initialRootDir, showRecent = true } = options;
  const recent = showRecent ? getRecentProjectsForDisplay() : [];
  const browseChoices = getProjectDirectoryChoices(cwd);

  const choices: { name: string; value: string }[] = [];
  if (recent.length > 0) {
    for (const p of recent) {
      choices.push({ name: `${p.name} ${chalk.gray("(recent)")}`, value: resolve(p.path) });
    }
  }
  for (const c of browseChoices) {
    choices.push(c);
  }

  const defaultVal = initialRootDir && choices.some((c) => c.value === resolve(initialRootDir))
    ? initialRootDir
    : choices[0]?.value ?? cwd;

  let selected = await select({
    message: "Select project directory",
    choices,
    default: defaultVal,
    loop: true,
    pageSize: 12,
  });

  if (selected === OTHER_DIR_CHOICE) {
    selected = await inquirerInput({
      message: "Enter project directory path",
      default: cwd,
      validate: (value) => {
        const path = resolve(value.trim() || ".");
        if (!existsSync(path)) return "Path does not exist.";
        if (!statSync(path).isDirectory()) return "Path is not a directory.";
        return true;
      },
    });
    selected = resolve(selected.trim() || ".");
  }

  return resolve(selected);
}
