export const goals = {
  simpler: "paprasčiau", cheaper: "pigiau", healthier: "sveikiau", original: "kuo panašiau į originalą",
} as const;
export type AiOptions = { minutes: 15 | 30 | 60; people: 1 | 2 | 4; goal: keyof typeof goals };
export const defaultAiOptions: AiOptions = { minutes: 30, people: 2, goal: "original" };
