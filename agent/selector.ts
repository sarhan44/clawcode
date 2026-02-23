/**
 * Selects a minimal set of relevant files for LLM context.
 * Uses task keywords and file list; does not send entire repo.
 */

import type { ScannedFile } from "../utils/scanner.js";

// Keep under typical provider limits (e.g. Groq ~8k input tokens ≈ ~24k chars)
const MAX_CONTEXT_FILES = 12;
const MAX_TOTAL_CHARS = 18_000;

function tokenize(task: string): Set<string> {
  const normalized = task.toLowerCase().replace(/[^\w\s./-]/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);
  return new Set(words);
}

function scoreFile(file: ScannedFile, keywords: Set<string>): number {
  const path = file.relativePath.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (path.includes(kw)) score += 10;
    if (file.content.toLowerCase().includes(kw)) score += 2;
  }
  if (score === 0) return 0;
  const sizePenalty = Math.min(file.content.length / 1000, 5);
  return score - sizePenalty;
}

export function selectRelevantFiles(
  task: string,
  files: ScannedFile[]
): ScannedFile[] {
  const keywords = tokenize(task);
  const scored = files.map((f) => ({ file: f, score: scoreFile(f, keywords) }));
  scored.sort((a, b) => b.score - a.score);

  const selected: ScannedFile[] = [];
  let totalChars = 0;
  for (const { file } of scored) {
    if (selected.length >= MAX_CONTEXT_FILES) break;
    if (totalChars + file.content.length > MAX_TOTAL_CHARS) continue;
    selected.push(file);
    totalChars += file.content.length;
  }

  if (selected.length === 0 && files.length > 0) {
    for (const f of files.slice(0, Math.min(6, files.length))) {
      if (totalChars + f.content.length <= MAX_TOTAL_CHARS) {
        selected.push(f);
        totalChars += f.content.length;
      }
    }
  }
  return selected;
}
