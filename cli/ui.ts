/**
 * Polished CLI UX: banner, spinners, colored sections, summary/error boxes.
 */

import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import logSymbols from "log-symbols";

const margin = (t: number, r: number, b: number, l: number) => ({ top: t, right: r, bottom: b, left: l });

export function showHeader(): void {
  const title = chalk.bold.cyan("CLAWCODE");
  const tagline = chalk.gray("AI Coding Agent");
  console.log(`\n${title}  ${tagline}\n`);
}

export function sectionPlanning(): void {
  console.log(chalk.blue(`\n${logSymbols.info} Planning...`));
}

export function sectionScanning(): void {
  console.log(chalk.blue(`\n${logSymbols.info} Scanning project...`));
}

export function sectionApplyingPatches(): void {
  console.log(chalk.magenta(`\n${logSymbols.info} Applying patches...`));
}

export function sectionRunningTests(): void {
  console.log(chalk.yellow(`\n${logSymbols.info} Running tests...`));
}

export function sectionCreatingBranch(): void {
  console.log(chalk.green(`\n${logSymbols.info} Creating branch...`));
}

export function sectionSuccess(): void {
  console.log(chalk.green(`\n${logSymbols.success} Success`));
}

export function sectionFailed(): void {
  console.log(chalk.red(`\n${logSymbols.error} Failed`));
}

export function createSpinner(text: string): ReturnType<typeof ora> {
  return ora({ text, color: "cyan" }).start();
}

export function showAnalysis(analysis: string): void {
  console.log(chalk.bold("\n--- Analysis ---"));
  console.log(analysis);
}

export function showFilesToEdit(files: { path: string; reason: string }[]): void {
  if (files.length === 0) return;
  console.log(chalk.bold("\n--- Files to edit ---"));
  for (const f of files) {
    console.log(`  ${f.path}: ${f.reason}`);
  }
}

export function showPatchWarnings(failed: [string, { error?: string }][]): void {
  if (failed.length === 0) return;
  console.log(chalk.yellow("\n--- Patch warnings ---"));
  for (const [file, r] of failed) {
    console.log(`  ${file}: ${r.error ?? "not applied"}`);
  }
}

export function showDiffs(diffs: string[]): void {
  if (diffs.length === 0) return;
  console.log(chalk.bold("\n--- Diff (before applying) ---"));
  for (const block of diffs) {
    for (const line of block.split("\n")) {
      if (line.startsWith("---") || line.startsWith("+++")) {
        console.log(chalk.cyan(line));
      } else if (line.startsWith("-")) {
        console.log(chalk.red(line));
      } else if (line.startsWith("+")) {
        console.log(chalk.green(line));
      } else {
        console.log(chalk.gray(line));
      }
    }
    console.log();
  }
}

export function showCommands(commands: string[]): void {
  if (commands.length === 0) return;
  console.log(chalk.bold("\n--- Commands ---"));
  commands.forEach((c) => console.log("  " + c));
}

export interface SummaryOptions {
  provider: string;
  filesModified: string[];
  branchName?: string;
  iterations?: number;
}

export function showSummaryBox(options: SummaryOptions): void {
  const lines: string[] = [
    chalk.bold("Summary"),
    "",
    `${chalk.cyan("Provider:")} ${options.provider}`,
    `${chalk.cyan("Files modified:")} ${options.filesModified.length > 0 ? options.filesModified.join(", ") : "none"}`,
  ];
  if (options.branchName) {
    lines.push(`${chalk.cyan("Branch:")} ${options.branchName}`);
  }
  if (options.iterations != null && options.iterations > 0) {
    lines.push(`${chalk.cyan("Iterations:")} ${options.iterations}`);
  }
  console.log(
    boxen(lines.join("\n"), {
      padding: 1,
      margin: margin(1, 0, 0, 0),
      borderColor: "gray",
      borderStyle: "round",
    })
  );
}

export function showErrorBox(message: string, debug?: boolean): void {
  const content = debug ? message : message.split("\n")[0] ?? message;
  console.error(
    boxen(chalk.red(content), {
      padding: 1,
      margin: margin(1, 0, 0, 0),
      borderColor: "red",
      borderStyle: "round",
    })
  );
}

export function showClawCodePrompt(): void {
  process.stdout.write(chalk.cyan("clawcode> "));
}

/** @deprecated Use showClawCodePrompt. */
export function showHelixPrompt(): void {
  showClawCodePrompt();
}
