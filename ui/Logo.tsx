import React from "react";
import { Box, Text } from "ink";

const LOGO_LINES = [
  "██████╗██╗      █████╗ ██╗    ██╗ ██████╗ ██████╗ ██████╗ ███████╗",
  "██╔════╝██║     ██╔══██╗██║    ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝",
  "██║     ██║     ███████║██║ █╗ ██║██║     ██║   ██║██║  ██║█████╗  ",
  "██║     ██║     ██╔══██║██║███╗██║██║     ██║   ██║██║  ██║██╔══╝  ",
  "╚██████╗███████╗██║  ██║╚███╔███╔╝╚██████╗╚██████╔╝██████╔╝███████╗",
  " ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
] as const;

export function Logo() {
  const primary = "#00E5FF";
  return (
    <Box flexDirection="column" alignItems="center" marginTop={1} marginBottom={1}>
      {LOGO_LINES.map((line) => (
        <Text key={line} color={primary}>
          {line}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          AI Coding Agent
        </Text>
      </Box>
    </Box>
  );
}

