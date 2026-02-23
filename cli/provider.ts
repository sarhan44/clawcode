/**
 * Provider selection UI (Azure / Groq / Gemini) with optional session cache.
 */

import { select } from "@inquirer/prompts";
import chalk from "chalk";
import type { AzureConfig, GroqConfig, GeminiConfig, ProviderConfig } from "../llm/provider.js";

export type ProviderKind = "azure" | "groq" | "gemini";

let sessionProvider: ProviderKind | null = null;

export function getCachedProvider(): ProviderKind | null {
  return sessionProvider;
}

export function setCachedProvider(kind: ProviderKind | null): void {
  sessionProvider = kind;
}

function toProviderConfig(
  provider: ProviderKind,
  config: AzureConfig | GroqConfig | GeminiConfig
): ProviderConfig {
  if (provider === "azure") return { provider: "azure", config: config as AzureConfig };
  if (provider === "gemini") return { provider: "gemini", config: config as GeminiConfig };
  return { provider: "groq", config: config as GroqConfig };
}

export async function selectProviderUI(
  azure: AzureConfig | null,
  groq: GroqConfig | null,
  gemini: GeminiConfig | null,
  providerFlag: ProviderKind | null
): Promise<ProviderConfig> {
  if (providerFlag === "azure") {
    if (!azure) {
      console.error(
        chalk.red("Azure selected but config missing. Run: clawcode config")
      );
      process.exit(1);
    }
    setCachedProvider("azure");
    return toProviderConfig("azure", azure);
  }
  if (providerFlag === "groq") {
    if (!groq) {
      console.error(chalk.red("Groq selected but config missing. Run: clawcode config"));
      process.exit(1);
    }
    setCachedProvider("groq");
    return toProviderConfig("groq", groq);
  }
  if (providerFlag === "gemini") {
    if (!gemini) {
      console.error(chalk.red("Gemini selected but config missing. Run: clawcode config"));
      process.exit(1);
    }
    setCachedProvider("gemini");
    return toProviderConfig("gemini", gemini);
  }

  const choices: { name: string; value: ProviderKind }[] = [];
  if (azure) choices.push({ name: "Azure OpenAI", value: "azure" });
  if (groq) choices.push({ name: "Groq", value: "groq" });
  if (gemini) choices.push({ name: "Google Gemini", value: "gemini" });

  if (choices.length > 1) {
    const defaultChoice = sessionProvider && choices.some((c) => c.value === sessionProvider)
      ? sessionProvider
      : choices[0]!.value;
    const chosen = await select<ProviderKind>({
      message: "Select AI Provider",
      choices,
      default: defaultChoice,
      loop: true,
    });
    setCachedProvider(chosen);
    const config = chosen === "azure" ? azure : chosen === "gemini" ? gemini : groq;
    return toProviderConfig(chosen, config!);
  }
  if (azure) {
    setCachedProvider("azure");
    return toProviderConfig("azure", azure);
  }
  if (groq) {
    setCachedProvider("groq");
    return toProviderConfig("groq", groq);
  }
  if (gemini) {
    setCachedProvider("gemini");
    return toProviderConfig("gemini", gemini);
  }
  console.error(
    chalk.red(
      "No AI provider configured. Run: clawcode config"
    )
  );
  process.exit(1);
}
