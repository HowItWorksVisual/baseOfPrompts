// Повторяет schema/prompt.schema.json
export type Format = "svg" | "html" | "webgl";
export type Size = "figure" | "hero";

export interface Variable {
  name: string;
  label: string;
  default: string;
  hint?: string;
  options?: string[];
}

export interface PromptEntry {
  id: string;
  title: string;
  summary: string;
  format: Format;
  size: Size;
  category: string;
  tags: string[];
  animated: boolean;
  prompt: string;
  variables: Variable[];
  qualityChecklist: string[];
  example?: { dark: string; light?: string };
  source?: string;
  createdAt: string;
}
