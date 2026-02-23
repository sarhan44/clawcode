/**
 * Ink UI entry: render App with event-driven agent.
 */

import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export interface RunUIOptions {
  rootDir: string;
  provider: string;
  model?: string;
  branch?: string;
  emitter: import("../agent/events.js").AgentEmitter;
  runTask: (params: {
    rootDir: string;
    task: string;
    emitter: import("../agent/events.js").AgentEmitter;
  }) => Promise<void>;
}

export function runInkUI(options: RunUIOptions): Promise<void> {
  const { rootDir, provider, model, branch, emitter, runTask } = options;
  const { waitUntilExit } = render(
    React.createElement(App, {
      rootDir,
      provider,
      model,
      branch,
      emitter,
      runTask,
    })
  );
  return waitUntilExit();
}
