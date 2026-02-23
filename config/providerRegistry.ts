/**
 * Provider registry: metadata and credential prompts per provider.
 * Used by onboarding to prompt for credentials and validate.
 */

import type { ProviderId } from "./types.js";
import type { AzureCredentials, GroqCredentials, GeminiCredentials } from "./types.js";

export interface CredentialPrompt {
  key: keyof AzureCredentials | keyof GroqCredentials | keyof GeminiCredentials;
  label: string;
  placeholder?: string;
  default?: string;
  mask?: boolean;
}

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  prompts: CredentialPrompt[];
}

const REGISTRY: ProviderMeta[] = [
  {
    id: "azure",
    label: "Azure OpenAI",
    prompts: [
      { key: "endpoint", label: "Azure endpoint URL", placeholder: "https://your-resource.openai.azure.com/" },
      { key: "apiKey", label: "Azure API key", mask: true },
      { key: "deployment", label: "Deployment name", default: "gpt-4o" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    prompts: [
      { key: "apiKey", label: "Groq API key", mask: true },
      { key: "model", label: "Model", default: "openai/gpt-oss-120b" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    prompts: [
      { key: "apiKey", label: "Gemini API key", mask: true },
      { key: "model", label: "Model", default: "gemini-2.0-flash" },
    ],
  },
];

/**
 * Returns all registered providers.
 */
export function getProviderRegistry(): ProviderMeta[] {
  return [...REGISTRY];
}

/**
 * Returns metadata for one provider.
 */
export function getProviderMeta(id: ProviderId): ProviderMeta | undefined {
  return REGISTRY.find((p) => p.id === id);
}

/**
 * Returns provider ids that are not yet in the config (so we can show "remaining" only).
 */
export function getRemainingProviderIds(
  configuredIds: ProviderId[]
): ProviderId[] {
  const set = new Set(configuredIds);
  return (REGISTRY.map((p) => p.id) as ProviderId[]).filter((id) => !set.has(id));
}

/**
 * Validates credential shape for a provider. Returns error message or null.
 */
export function validateCredentials(
  id: ProviderId,
  creds: Record<string, unknown>
): string | null {
  if (id === "azure") {
    const a = creds as Partial<AzureCredentials>;
    if (!a?.endpoint?.trim()) return "Endpoint is required";
    if (!a?.apiKey?.trim()) return "API key is required";
    if (!a?.deployment?.trim()) return "Deployment name is required";
    return null;
  }
  if (id === "groq") {
    const g = creds as Partial<GroqCredentials>;
    if (!g?.apiKey?.trim()) return "API key is required";
    return null;
  }
  if (id === "gemini") {
    const g = creds as Partial<GeminiCredentials>;
    if (!g?.apiKey?.trim()) return "API key is required";
    return null;
  }
  return "Unknown provider";
}

/**
 * Builds typed credentials object for a provider from a record.
 */
export function buildCredentials(
  id: ProviderId,
  raw: Record<string, unknown>
):
  | AzureCredentials
  | GroqCredentials
  | GeminiCredentials
  | null {
  if (id === "azure") {
    const endpoint = String(raw.endpoint ?? "").trim();
    const apiKey = String(raw.apiKey ?? "").trim();
    const deployment = String(raw.deployment ?? "gpt-4o").trim();
    if (!endpoint || !apiKey) return null;
    return { endpoint, apiKey, deployment };
  }
  if (id === "groq") {
    const apiKey = String(raw.apiKey ?? "").trim();
    if (!apiKey) return null;
    const model = raw.model != null ? String(raw.model).trim() : undefined;
    return { apiKey, model: model || undefined };
  }
  if (id === "gemini") {
    const apiKey = String(raw.apiKey ?? "").trim();
    if (!apiKey) return null;
    const model = raw.model != null ? String(raw.model).trim() : undefined;
    return { apiKey, model: model || "gemini-2.0-flash" };
  }
  return null;
}
