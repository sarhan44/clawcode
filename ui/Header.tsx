import React from "react";
import { Box, Text } from "ink";

export function Header({
  provider,
  project,
  branch,
}: {
  provider: string;
  project: string;
  branch?: string;
}) {
  const projectShort = project.split("/").filter(Boolean).pop() ?? project;
  const primary = "#00E5FF";
  return (
    <Box justifyContent="center" marginBottom={1}>
      <Text bold color={primary}>
        clawcode
      </Text>
      <Text color="gray" dimColor>
        {"  provider: "}
      </Text>
      <Text color="gray" dimColor>
        {provider || "—"}
      </Text>
      <Text color="gray" dimColor>
        {"  |  "}
      </Text>
      <Text color="gray" dimColor>
        {"project: "}
      </Text>
      <Text color="yellow">{projectShort || "—"}</Text>
      {branch != null && branch !== "" && (
        <>
          <Text color="gray" dimColor>
            {"  |  "}
          </Text>
          <Text color="gray" dimColor>
            {"branch: "}
          </Text>
          <Text color="magenta">{branch}</Text>
        </>
      )}
    </Box>
  );
}
