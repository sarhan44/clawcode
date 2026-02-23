import React from "react";
import { Box, Text } from "ink";

export function StatusBar({
  autoFixEnabled = false,
  iteration,
  model,
  memoryActive = true,
}: {
  autoFixEnabled?: boolean;
  iteration?: { current: number; total: number } | null;
  model: string;
  memoryActive?: boolean;
}) {
  return (
    <Box marginTop={1} paddingX={1}>
      <Text color="gray" dimColor>
        <Text color="gray" dimColor>
          Mode:
        </Text>
        <Text> </Text>
        <Text color={autoFixEnabled ? "green" : "gray"} dimColor={!autoFixEnabled}>
          Auto-fix {autoFixEnabled ? "ON" : "OFF"}
        </Text>
        <Text color="gray" dimColor>
          {"  |  "}
        </Text>
        <Text color="gray" dimColor>
          Iteration:
        </Text>
        <Text> </Text>
        <Text color="gray" dimColor>
          {iteration ? `${iteration.current}/${iteration.total}` : "—"}
        </Text>
        <Text color="gray" dimColor>
          {"  |  "}
        </Text>
        <Text color="gray" dimColor>
          Model:
        </Text>
        <Text> </Text>
        <Text color="gray" dimColor>
          {model || "—"}
        </Text>
        <Text color="gray" dimColor>
          {"  |  "}
        </Text>
        <Text color="gray" dimColor>
          Memory:
        </Text>
        <Text> </Text>
        <Text color={memoryActive ? "green" : "gray"} dimColor={!memoryActive}>
          {memoryActive ? "active" : "off"}
        </Text>
      </Text>
    </Box>
  );
}
