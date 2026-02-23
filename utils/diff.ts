/**
 * Simple unified-style diff for showing find/replace changes.
 */

export function makeUnifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      out.push(" " + oldLines[i]);
      i++;
      j++;
      continue;
    }
    const startI = i;
    const startJ = j;
    while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) i++;
    while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) j++;
    const removed = i - startI;
    const added = j - startJ;
    out.push(`@@ -${startI + 1},${removed} +${startJ + 1},${added} @@`);
    for (let k = startI; k < i; k++) out.push("-" + oldLines[k]);
    for (let k = startJ; k < j; k++) out.push("+" + newLines[k]);
  }

  return out.join("\n");
}

export function makeReplaceDiff(filePath: string, find: string, replace: string): string {
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
  for (const line of find.split("\n")) lines.push("-" + line);
  for (const line of replace.split("\n")) lines.push("+" + line);
  return lines.join("\n");
}
