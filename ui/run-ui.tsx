/**
 * Ink UI entry: render App with event-driven agent.
 */

import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export interface RunUIOptions {
  rootDir: string;
  env: Record<string, string>;
  provider: string;
  model?: string;
  branch?: string;
  emitter: import("../agent/events.js").AgentEmitter;
  runTask: (params: {
    rootDir: string;
    task: string;
    env: Record<string, string>;
    emitter: import("../agent/events.js").AgentEmitter;
  }) => Promise<void>;
}

export function runInkUI(options: RunUIOptions): Promise<void> {
  const { rootDir, env, provider, model, branch, emitter, runTask } = options;
  const { waitUntilExit } = render(
    React.createElement(App, {
      rootDir,
      env,
      provider,
      model,
      branch,
      emitter,
      runTask,
    })
  );
  return waitUntilExit();
}
