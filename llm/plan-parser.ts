/**
 * Shared JSON plan parsing for any LLM response.
 */

import type { AgentPlan } from "./types.js";

function extractJson(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return trimmed;
  return trimmed.slice(start, end + 1);
}

export function parsePlanJson(raw: string): AgentPlan {
  const json = extractJson(raw);
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response is not a JSON object");
  }
  const p = parsed as Record<string, unknown>;
  const analysis = typeof p.analysis === "string" ? p.analysis : "";
  const files_to_edit = Array.isArray(p.files_to_edit)
    ? (p.files_to_edit as Array<{ path: string; reason: string }>).map((f) => ({
        path: String(f?.path ?? ""),
        reason: String(f?.reason ?? ""),
      }))
    : [];
  const patches = Array.isArray(p.patches)
    ? (p.patches as Array<{ file: string; operation: string; find: string; replace: string }>).map(
        (x) => ({
          file: String(x?.file ?? ""),
          operation: "replace" as const,
          find: String(x?.find ?? ""),
          replace: String(x?.replace ?? ""),
        })
      )
    : [];
  const commands = Array.isArray(p.commands)
    ? (p.commands as unknown[]).map((c) => String(c))
    : [];
  const agent_notes = Array.isArray(p.agent_notes)
    ? (p.agent_notes as unknown[]).map((n) => String(n)).filter(Boolean)
    : undefined;
  return { analysis, files_to_edit, patches, commands, agent_notes };
}
