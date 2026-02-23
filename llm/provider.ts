/**
 * Provider-agnostic LLM: dispatch to Azure, Groq, or Gemini based on config.
 */

import type { AgentPlan } from "./types.js";
import type { AzureConfig } from "./azure-client.js";
import { getStructuredPlanAzure } from "./azure-client.js";
import type { GroqConfig } from "./groq-client.js";
import { getStructuredPlanGroq } from "./groq-client.js";
import type { GeminiConfig } from "./gemini-client.js";
import { getStructuredPlanGemini } from "./gemini-client.js";

export type ProviderKind = "azure" | "groq" | "gemini";

export type ProviderConfig =
  | { provider: "azure"; config: AzureConfig }
  | { provider: "groq"; config: GroqConfig }
  | { provider: "gemini"; config: GeminiConfig };

export type { AzureConfig } from "./azure-client.js";
export type { GroqConfig } from "./groq-client.js";
export type { GeminiConfig } from "./gemini-client.js";

export async function getStructuredPlan(
  providerConfig: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AgentPlan> {
  if (providerConfig.provider === "azure") {
    return getStructuredPlanAzure(providerConfig.config, systemPrompt, userPrompt);
  }
  if (providerConfig.provider === "gemini") {
    return getStructuredPlanGemini(providerConfig.config, systemPrompt, userPrompt);
  }
  return getStructuredPlanGroq(providerConfig.config, systemPrompt, userPrompt);
}
