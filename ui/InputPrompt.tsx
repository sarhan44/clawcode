import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export function InputPrompt({
  onSubmit,
  disabled,
  placeholder = "Enter task...",
  onScroll,
}: {
  onSubmit: (task: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Ctrl+Up/Down scroll the activity feed. */
  onScroll?: (direction: 1 | -1) => void;
}) {
  const [value, setValue] = useState("");
  const [cursorIndex, setCursorIndex] = useState(0);

  useInput((input, key) => {
    if (key.ctrl && key.upArrow) {
      onScroll?.(1);
      return;
    }
    if (key.ctrl && key.downArrow) {
      onScroll?.(-1);
      return;
    }
    if (disabled) return;
    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setValue("");
        setCursorIndex(0);
      }
      return;
    }
    if (key.leftArrow) {
      setCursorIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorIndex((i) => Math.min(value.length, i + 1));
      return;
    }
    // Backspace: delete before cursor. Many terminals send key.delete for the Backspace key.
    if (key.backspace || key.delete) {
      if (cursorIndex > 0) {
        setValue((v) => v.slice(0, cursorIndex - 1) + v.slice(cursorIndex));
        setCursorIndex((i) => i - 1);
      }
      return;
    }
    if (input) {
      setValue((v) => v.slice(0, cursorIndex) + input + v.slice(cursorIndex));
      setCursorIndex((i) => i + input.length);
    }
  });

  const left = value.slice(0, cursorIndex);
  const cursorChar = value[cursorIndex] ?? " ";
  const right = value.slice(cursorIndex + 1);

  return (
    <Box marginTop={1}>
      <Text color="#00E5FF" bold>
        clawcode
      </Text>
      <Text color="#00E5FF"> ❯ </Text>
      {value.length === 0 && cursorIndex === 0 ? (
        <>
          <Text inverse>{cursorChar}</Text>
          {placeholder && (
            <Text color="gray" dimColor>
              {placeholder}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text>{left}</Text>
          <Text inverse>{cursorChar}</Text>
          <Text>{right}</Text>
        </>
      )}
    </Box>
  );
}
