/**
 * Azure OpenAI chat completions client.
 * Uses endpoint + API key; deployment = model deployment name.
 */

import OpenAI from "openai";
import type { AgentPlan } from "./types.js";
import { parsePlanJson } from "./plan-parser.js";

const TEMPERATURE = 0.2;
const MAX_TOKENS = 4096;

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

function createAzureClient(config: AzureConfig): OpenAI {
  const baseURL =
    config.endpoint.replace(/\/$/, "") + "/openai/deployments/" + config.deployment;
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL,
  });
}

export async function getStructuredPlanAzure(
  config: AzureConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AgentPlan> {
  const client = createAzureClient(config);
  const response = await client.chat.completions.create({
    model: config.deployment,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });

  const choice = response.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("Empty response from Azure OpenAI");
  }
  return parsePlanJson(content);
}
