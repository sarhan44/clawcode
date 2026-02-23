/**
 * First-run onboarding: welcome, provider selection, credential prompts,
 * save to ~/.clawcode/config.json, optional add-another, then setup complete.
 * No plaintext logging of credentials.
 */

import { input, select, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import {
  readConfig,
  writeConfig,
  hasProviders,
  ensureConfigDir,
} from "../config/config.js";
import type { ClawCodeConfig, ProviderId } from "../config/types.js";
import type { AzureCredentials, GroqCredentials, GeminiCredentials } from "../config/types.js";
import {
  getProviderRegistry,
  getProviderMeta,
  getRemainingProviderIds,
  validateCredentials,
  buildCredentials,
} from "../config/providerRegistry.js";

const WELCOME = "Welcome to ClawCode 🚀 Let's configure your AI provider.";
const SETUP_COMPLETE = "Setup complete!";
const SKIP_VALUE = "__skip__" as const;

/**
 * Returns true if onboarding was run (or skipped because config exists).
 */
export async function runOnboardingIfNeeded(): Promise<boolean> {
  ensureConfigDir();
  let config = readConfig();
  if (hasProviders(config)) {
    return false;
  }

  console.log(chalk.cyan("\n" + WELCOME + "\n"));

  const configuredIds: ProviderId[] = [];
  let defaultProvider: ProviderId | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const choices = configuredIds.length > 0
      ? getRemainingProviderIds(configuredIds)
      : (getProviderRegistry().map((p) => p.id) as ProviderId[]);

    if (choices.length === 0) {
      break;
    }

    const providerLabels = getProviderRegistry()
      .filter((p) => choices.includes(p.id))
      .map((p) => ({ name: p.label, value: p.id }));
    const choiceLabels =
      configuredIds.length === 0
        ? [{ name: "Skip for now (configure later)", value: SKIP_VALUE }, ...providerLabels]
        : providerLabels;

    const selected = await select<ProviderId | typeof SKIP_VALUE>({
      message: "Select AI provider",
      choices: choiceLabels,
      loop: true,
    });

    if (selected === SKIP_VALUE) {
      console.log(chalk.gray("\nYou can configure providers later with: clawcode config\n"));
      return true;
    }

    const meta = getProviderMeta(selected);
    if (!meta) continue;

    const raw: Record<string, string> = {};
    for (const prompt of meta.prompts) {
      const value = prompt.mask
        ? await password({
            message: prompt.label,
            mask: "*",
          })
        : await input({
            message: prompt.label,
            default: prompt.default ?? "",
          });
      raw[prompt.key] = value;
    }

    const err = validateCredentials(selected, raw);
    if (err) {
      console.log(chalk.red(err));
      continue;
    }

    const creds = buildCredentials(selected, raw as unknown as Record<string, unknown>);
    if (!creds) continue;

    if (!config) {
      config = {
        defaultProvider: selected,
        providers: {},
      };
    }
    if (!defaultProvider) defaultProvider = selected;
    config.defaultProvider = defaultProvider;

    switch (selected) {
      case "azure":
        config.providers.azure = creds as AzureCredentials;
        break;
      case "groq":
        config.providers.groq = creds as GroqCredentials;
        break;
      case "gemini":
        config.providers.gemini = creds as GeminiCredentials;
        break;
    }
    configuredIds.push(selected);

    const addAnother = await confirm({
      message: "Add another provider?",
      default: false,
    });
    if (!addAnother) break;
  }

  if (!config || !hasProviders(config)) {
    console.log(chalk.yellow("No provider configured. Run clawcode again to set up."));
    return true;
  }

  writeConfig(config);

  const spinner = ora("Setting up models...").start();
  await new Promise((r) => setTimeout(r, 2000));
  spinner.succeed(SETUP_COMPLETE + "\n");

  return true;
}

/**
 * Run provider configuration (add or update providers). Used by `clawcode config`.
 */
export async function runProviderConfig(): Promise<void> {
  ensureConfigDir();
  let config = readConfig();

  console.log(chalk.cyan("\nConfigure AI providers\n"));

  const configuredIds: ProviderId[] = config
    ? ([
        config.providers?.azure && "azure",
        config.providers?.groq && "groq",
        config.providers?.gemini && "gemini",
      ].filter(Boolean) as ProviderId[])
    : [];

  let defaultProvider: ProviderId | null = config?.defaultProvider ?? null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const choices = configuredIds.length > 0
      ? getRemainingProviderIds(configuredIds)
      : (getProviderRegistry().map((p) => p.id) as ProviderId[]);

    if (choices.length === 0) {
      console.log(chalk.green("All providers configured. Use clawcode to get started.\n"));
      break;
    }

    const choiceLabels = getProviderRegistry()
      .filter((p) => choices.includes(p.id))
      .map((p) => ({ name: p.label, value: p.id }));

    const selected = await select<ProviderId>({
      message: "Add provider",
      choices: choiceLabels,
      loop: true,
    });

    const meta = getProviderMeta(selected);
    if (!meta) continue;

    const raw: Record<string, string> = {};
    for (const prompt of meta.prompts) {
      const value = prompt.mask
        ? await password({ message: prompt.label, mask: "*" })
        : await input({ message: prompt.label, default: prompt.default ?? "" });
      raw[prompt.key] = value;
    }

    const err = validateCredentials(selected, raw);
    if (err) {
      console.log(chalk.red(err));
      continue;
    }

    const creds = buildCredentials(selected, raw as unknown as Record<string, unknown>);
    if (!creds) continue;

    if (!config) {
      config = { defaultProvider: selected, providers: {} };
    }
    if (!defaultProvider) defaultProvider = selected;
    config.defaultProvider = defaultProvider;

    switch (selected) {
      case "azure":
        config.providers.azure = creds as AzureCredentials;
        break;
      case "groq":
        config.providers.groq = creds as GroqCredentials;
        break;
      case "gemini":
        config.providers.gemini = creds as GeminiCredentials;
        break;
    }
    configuredIds.push(selected);

    const addAnother = await confirm({ message: "Add another provider?", default: false });
    if (!addAnother) break;
  }

  if (config && hasProviders(config)) {
    writeConfig(config);
    console.log(chalk.green("Config saved to ~/.clawcode/config.json\n"));
  }
}
