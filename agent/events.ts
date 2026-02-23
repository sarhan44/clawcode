/**
 * Agent event types and emitter for UI / event-driven consumers.
 */

export type AgentEventType =
  | "planning"
  | "read_file"
  | "write_file"
  | "run_tests"
  | "error"
  | "success"
  | "diffs";

export interface AgentEventPayload {
  planning: { task: string };
  read_file: { path: string };
  write_file: { path: string };
  run_tests: { command: string };
  error: { message: string };
  success: { filesModified?: string[]; message?: string };
  diffs: { diffs: string[] };
}

export type AgentEmitterListener = (payload?: unknown) => void;

export interface AgentEmitter {
  emit(event: AgentEventType, payload?: unknown): void;
  on(event: AgentEventType, listener: AgentEmitterListener): () => void;
}

export function createAgentEmitter(): AgentEmitter {
  const listeners: Map<AgentEventType, Set<AgentEmitterListener>> = new Map();
  const eventTypes: AgentEventType[] = [
    "planning",
    "read_file",
    "write_file",
    "run_tests",
    "error",
    "success",
    "diffs",
  ];
  for (const e of eventTypes) listeners.set(e, new Set());

  return {
    emit(event: AgentEventType, payload?: AgentEventPayload[AgentEventType]) {
      listeners.get(event)?.forEach((fn) => fn(payload));
    },
    on(event: AgentEventType, listener: AgentEmitterListener) {
      listeners.get(event)!.add(listener);
      return () => listeners.get(event)!.delete(listener);
    },
  };
}
