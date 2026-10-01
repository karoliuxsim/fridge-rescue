import type { AiOptions } from "./ai-options";

export type GeneratedAiRecipe = {
  version: 1;
  generationId: string;
  originalMealId: string;
  originalTitle: string;
  situation: string;
  options: AiOptions;
  text: string;
  generatedAt: string;
};
export type AiReceipt = { payload: string; signature: string };
export type SavedAiRecipe = {
  id: string; generation_id: string; original_meal_id: string; original_title: string;
  situation: string; minutes: AiOptions["minutes"]; people: AiOptions["people"]; goal: AiOptions["goal"];
  ai_text: string; generated_at: string; created_at: string;
};
