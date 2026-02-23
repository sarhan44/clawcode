/**
 * Safe patch application: replace find with replace in file content.
 * Validates presence of find before applying.
 */

export interface PatchOp {
  file: string;
  operation: "replace";
  find: string;
  replace: string;
}

export interface PatchResult {
  file: string;
  applied: boolean;
  error?: string;
  newContent?: string;
}

export function applyPatch(content: string, find: string, replace: string): PatchResult {
  if (!find) {
    // Empty find is allowed only for empty/new files: treat as "set entire content"
    if (content.length === 0) {
      return { file: "", applied: true, newContent: replace };
    }
    return { file: "", applied: false, error: "Empty find string (only allowed for empty files)" };
  }
  const index = content.indexOf(find);
  if (index === -1) {
    return {
      file: "",
      applied: false,
      error: "Find string not found in content",
    };
  }
  const newContent = content.slice(0, index) + replace + content.slice(index + find.length);
  return { file: "", applied: true, newContent };
}

export function applyPatches(
  fileContents: Map<string, string>,
  patches: PatchOp[]
): Map<string, PatchResult> {
  const results = new Map<string, PatchResult>();
  const updated = new Map(fileContents);

  for (const p of patches) {
    const content = updated.get(p.file);
    if (content === undefined) {
      results.set(p.file, { file: p.file, applied: false, error: "File not in context" });
      continue;
    }
    const result = applyPatch(content, p.find, p.replace);
    result.file = p.file;
    results.set(p.file, result);
    if (result.applied && result.newContent !== undefined) {
      updated.set(p.file, result.newContent);
    }
  }

  return results;
}
