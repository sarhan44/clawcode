declare module "prompts" {
  interface Choice {
    title: string;
    value: string;
  }
  interface PromptObject {
    type: string;
    name: string;
    message: string;
    initial?: boolean;
    choices?: Choice[];
  }
  function prompts(
    prompts: PromptObject | PromptObject[],
    options?: { onCancel?: () => void }
  ): Promise<{ value?: boolean | string }>;
  export default prompts;
}
