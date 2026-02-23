/**
 * Groq chat completions client (OpenAI-compatible API).
 * Base URL: https://api.groq.com/openai/v1
 */

import OpenAI from "openai";
import type { AgentPlan } from "./types.js";
import { parsePlanJson } from "./plan-parser.js";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TEMPERATURE = 0.2;
const MAX_TOKENS = 4096;

export interface GroqConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

function createGroqClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
  });
}

export async function getStructuredPlanGroq(
  config: GroqConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AgentPlan> {
  const client = createGroqClient(config.apiKey);
  const model = config.model ?? DEFAULT_GROQ_MODEL;
  const response = await client.chat.completions.create({
    model,
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
    throw new Error("Empty response from Groq");
  }
  return parsePlanJson(content);
}
