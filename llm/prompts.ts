/**
 * System and user prompt builders for the coding agent.
 * Keeps context minimal: file list + selected file contents only.
 */

import type { ScannedFile } from "../utils/scanner.js";
import { PLAN_JSON_SCHEMA } from "./types.js";

export function buildSystemPrompt(): string {
  return `You are a precise coding agent. You receive a task and minimal project context (file paths and contents of relevant files only).

Your job is to produce a single JSON object (no markdown, no code fence) with:
1. analysis: Short explanation of the task and your approach.
2. files_to_edit: List of { path, reason } for files you will change (paths relative to project root).
3. patches: List of edits. Each has: file (relative path), operation: "replace", find (exact string in file), replace (exact replacement). Use exact string match; preserve indentation and newlines.
4. commands: Optional list of shell commands to run after edits (e.g. npm run build). Use if tests or build need to run.

Rules:
- Only reference files that were provided in the context (or a new file path to create).
- For patches, "find" must appear exactly in the given file content. For new or empty files, use "find": "" and "replace": "<full new content>".
- Prefer minimal, surgical edits. One patch per logical change when possible.
- Output only the JSON object, no other text.
${PLAN_JSON_SCHEMA}`;
}

export function buildUserPrompt(
  task: string,
  fileList: string[],
  selectedFiles: ScannedFile[],
  memoryContext?: string
): string {
  const fileListBlurb =
    "Project files (relative paths):\n" + fileList.slice(0, 60).join("\n");
  const fileContents = selectedFiles
    .map((f) => `--- ${f.relativePath} ---\n${f.content}\n`)
    .join("\n");

  const memoryBlock = memoryContext?.trim() ? memoryContext + "\n\n" : "";
  return `${memoryBlock}Task:\n${task}\n\n${fileListBlurb}\n\nRelevant file contents (use only these for patches):\n${fileContents}\n\nProduce the JSON plan.`;
}
