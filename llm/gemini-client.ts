/**
 * Google Gemini chat completions via REST API (Node 18+ fetch).
 */

import type { AgentPlan } from "./types.js";
import { parsePlanJson } from "./plan-parser.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 4096;

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

interface GeminiPart {
  text?: string;
}

interface GeminiContent {
  role?: string;
  parts: GeminiPart[];
}

interface GeminiRequest {
  systemInstruction?: { parts: GeminiPart[] };
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export async function getStructuredPlanGemini(
  config: GeminiConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<AgentPlan> {
  const model = (config.model ?? DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const body: GeminiRequest = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }
  return parsePlanJson(text);
}
