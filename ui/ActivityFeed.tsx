import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import logSymbols from "log-symbols";

export type FeedStatus = "active" | "done" | "error";

export interface FeedItem {
  id: number;
  icon: string;
  text: string;
  status: FeedStatus;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPIN_INTERVAL_MS = 80;

function StatusGlyph({ status, frame }: { status: FeedStatus; frame: string }) {
  if (status === "active") return <Text color="#00E5FF">{frame}</Text>;
  if (status === "error") return <Text color="red">{logSymbols.error}</Text>;
  return <Text color="green">{logSymbols.success}</Text>;
}

export function ActivityFeed({
  items,
  height = 14,
  scrollOffset = 0,
}: {
  items: FeedItem[];
  height?: number;
  /** Used by parent for scrollable panel (Ctrl+Up/Down). */
  scrollOffset?: number;
}) {
  const [frameIdx, setFrameIdx] = useState(0);
  const hasActive = useMemo(() => items.some((i) => i.status === "active"), [items]);

  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => setFrameIdx((f) => (f + 1) % SPINNER_FRAMES.length), SPIN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasActive]);

  const maxScroll = Math.max(0, items.length - height);
  const start = Math.min(scrollOffset, maxScroll);
  const slice = items.slice(start, start + height);
  const spinner = SPINNER_FRAMES[frameIdx]!;

  return (
    <Box
      flexDirection="column"
      height={height}
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
    >
      {slice.length === 0 ? (
        <Text color="gray" dimColor>
          Waiting for task… (Ctrl+↑/↓ scroll)
        </Text>
      ) : (
        slice.map((it, idx) => {
          const isOlder = idx < slice.length - 6;
          const dim = isOlder && it.status !== "error";
          const textColor = it.status === "error" ? "red" : dim ? "gray" : "white";
          return (
            <Box key={it.id}>
              <Box width={2}>
                <StatusGlyph status={it.status} frame={spinner} />
              </Box>
              <Box width={2}>
                <Text>{it.icon}</Text>
              </Box>
              <Text color={textColor} dimColor={dim}>
                {it.text}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
