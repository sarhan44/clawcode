import React, { useState, useEffect, useRef } from "react";
import { Box } from "ink";
import type { AgentEmitter } from "../agent/events.js";
import type { FeedItem } from "./ActivityFeed.js";
import { ActivityFeed } from "./ActivityFeed.js";
import { DiffView } from "./DiffView.js";
import { Logo } from "./Logo.js";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";
import { InputPrompt } from "./InputPrompt.js";

export interface AppProps {
  rootDir: string;
  env: Record<string, string>;
  provider: string;
  model?: string;
  branch?: string;
  emitter: AgentEmitter;
  runTask: (params: {
    rootDir: string;
    task: string;
    env: Record<string, string>;
    emitter: AgentEmitter;
  }) => Promise<void>;
}

const FEED_HEIGHT = 12;

function eventToFeedItem(event: string, payload: unknown): Omit<FeedItem, "id" | "status"> | null {
  const p = payload as Record<string, string> | undefined;
  if (event === "planning") return { icon: "🧠", text: "Planning" };
  if (event === "read_file") return { icon: "🔎", text: `Reading ${p?.path ?? ""}`.trim() };
  if (event === "write_file") return { icon: "✍", text: `Writing patch to ${p?.path ?? ""}`.trim() };
  if (event === "run_tests") return { icon: "🧪", text: p?.command ? `Running ${p.command}` : "Running tests" };
  if (event === "diffs") return { icon: "🧾", text: "Diff ready" };
  if (event === "success") return { icon: "✅", text: p?.message ?? "Success" };
  if (event === "error") return { icon: "❌", text: p?.message ?? "Error" };
  return null;
}

export function App({ rootDir, env, provider, model, branch, emitter, runTask }: AppProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [diffs, setDiffs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const idRef = useRef(0);
  const activeRef = useRef<number | null>(null);
  const maxScroll = Math.max(0, items.length - FEED_HEIGHT);

  useEffect(() => {
    const eventTypes = [
      "planning",
      "read_file",
      "write_file",
      "run_tests",
      "error",
      "success",
      "diffs",
    ] as const;
    const unsubs = eventTypes.map((event) =>
      emitter.on(event, (payload) => {
        if (event === "error" || event === "success") {
          setIsRunning(false);
        }
        if (event === "diffs") {
          const p = payload as { diffs?: string[] };
          setDiffs(p?.diffs ?? []);
        }
        if (event === "planning") setDiffs([]);

        const base = eventToFeedItem(event, payload);
        if (!base) return;

        const id = ++idRef.current;
        setItems((prev) => {
          const next = [...prev];

          const markActive = (status: "done" | "error") => {
            const idx = activeRef.current;
            if (idx != null && next[idx]) next[idx] = { ...next[idx]!, status };
            activeRef.current = null;
          };

          if (event === "error") {
            markActive("error");
            next.push({ id, ...base, status: "error" });
            return next;
          }

          if (event === "success") {
            markActive("done");
            next.push({ id, ...base, status: "done" });
            return next;
          }

          // Steps with visible duration: planning, run_tests
          if (event === "planning" || event === "run_tests") {
            const idx = activeRef.current;
            if (idx != null && next[idx]) next[idx] = { ...next[idx]!, status: "done" };
            next.push({ id, ...base, status: "active" });
            activeRef.current = next.length - 1;
            return next;
          }

          // Instant events (file reads/writes, diff ready)
          next.push({ id, ...base, status: "done" });
          return next;
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [emitter]);

  useEffect(() => {
    setScrollOffset((prev) => Math.min(prev, maxScroll));
  }, [items.length, maxScroll]);

  const handleSubmit = async (task: string) => {
    setIsRunning(true);
    try {
      await runTask({ rootDir, task, env, emitter });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      emitter.emit("error", { message: msg });
    } finally {
      setIsRunning(false);
    }
  };

  const projectShort = rootDir.split("/").filter(Boolean).pop() ?? rootDir;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Logo />
      <Header provider={provider} project={projectShort} branch={branch} />
      <ActivityFeed items={items} height={FEED_HEIGHT} scrollOffset={scrollOffset} />
      {diffs.length > 0 && <DiffView diffs={diffs} height={8} />}
      <StatusBar
        autoFixEnabled={false}
        iteration={null}
        model={model ?? provider}
        memoryActive={true}
      />
      <InputPrompt
        onSubmit={handleSubmit}
        disabled={isRunning}
        placeholder="Enter task (Enter to run)…  Ctrl+↑/↓ scroll"
        onScroll={(d) => setScrollOffset((prev) => Math.max(0, Math.min(maxScroll, prev + d)))}
      />
    </Box>
  );
}
