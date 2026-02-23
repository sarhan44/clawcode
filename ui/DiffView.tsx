import React from "react";
import { Box, Text } from "ink";

/**
 * Renders unified-style diff lines with colors: red for removals, green for additions.
 */
export function DiffView({ diffs, height = 10 }: { diffs: string[]; height?: number }) {
  const lines: { line: string; type: "add" | "remove" | "context" }[] = [];
  for (const block of diffs) {
    for (const raw of block.split("\n")) {
      if (raw.startsWith("---") || raw.startsWith("+++")) {
        lines.push({ line: raw, type: "context" });
      } else if (raw.startsWith("-")) {
        lines.push({ line: raw.slice(1), type: "remove" });
      } else if (raw.startsWith("+")) {
        lines.push({ line: raw.slice(1), type: "add" });
      } else {
        lines.push({ line: raw, type: "context" });
      }
    }
  }
  const maxLines = Math.max(0, height - 1);
  const display = maxLines > 0 ? lines.slice(-maxLines) : [];
  return (
    <Box flexDirection="column" height={height} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray" dimColor>
        Diff preview
      </Text>
      {display.length === 0 ? (
        <Text color="gray" dimColor>
          No changes
        </Text>
      ) : (
        display.map(({ line, type }, i) => (
          <Text key={i}>
            {type === "remove" && <Text color="red">- </Text>}
            {type === "add" && <Text color="green">+ </Text>}
            {type === "context" && <Text color="gray">  </Text>}
            <Text color={type === "remove" ? "red" : type === "add" ? "green" : "gray"}>
              {line || " "}
            </Text>
          </Text>
        ))
      )}
    </Box>
  );
}
