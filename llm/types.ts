/**
 * Structured plan returned by the LLM. Must be valid JSON.
 */

export interface FileToEdit {
  path: string;
  reason: string;
}

export interface Patch {
  file: string;
  operation: "replace";
  find: string;
  replace: string;
}

export interface AgentPlan {
  analysis: string;
  files_to_edit: FileToEdit[];
  patches: Patch[];
  commands: string[];
  /** Optional notes from the agent to persist in session memory. */
  agent_notes?: string[];
}

export const PLAN_JSON_SCHEMA = `
The response must be a single JSON object with this exact shape (no markdown, no code fence):
{
  "analysis": "string: brief analysis of the task and approach",
  "files_to_edit": [
    { "path": "relative/file/path", "reason": "why this file" }
  ],
  "patches": [
    {
      "file": "relative/path/to/file",
      "operation": "replace",
      "find": "exact string to find in file (preserve whitespace)",
      "replace": "exact string to put in its place"
    }
  ],
  "commands": ["shell command 1", "shell command 2"],
  "agent_notes": ["optional string notes to persist for future runs"]
}
Rules: "file" in patches must be one of the paths in files_to_edit or from the context. agent_notes is optional. Use exact string match for find/replace. commands are optional shell commands to run after edits.
`;
