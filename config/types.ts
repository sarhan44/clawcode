/**
 * ClawCode config and provider credential types.
 * Stored in ~/.clawcode/config.json. No plaintext logging of credentials.
 */

export type ProviderId = "azure" | "groq" | "gemini";

export interface AzureCredentials {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export interface GroqCredentials {
  apiKey: string;
  model?: string;
}

export interface GeminiCredentials {
  apiKey: string;
  model?: string;
}

export type ProviderCredentials =
  | { provider: "azure"; credentials: AzureCredentials }
  | { provider: "groq"; credentials: GroqCredentials }
  | { provider: "gemini"; credentials: GeminiCredentials };

export interface ClawCodeConfig {
  defaultProvider: ProviderId;
  providers: {
    azure?: AzureCredentials;
    groq?: GroqCredentials;
    gemini?: GeminiCredentials;
  };
}

/** Legacy shape (same as ClawCodeConfig); used when reading ~/.helix during migration. */
export interface HelixConfig extends ClawCodeConfig {}

export function isClawCodeConfig(value: unknown): value is ClawCodeConfig {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.defaultProvider !== "string") return false;
  if (!o.providers || typeof o.providers !== "object") return false;
  return true;
}

export function isHelixConfig(value: unknown): value is HelixConfig {
  return isClawCodeConfig(value);
}
