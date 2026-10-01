import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { goals } from "@/types/ai-options";
import type { AiReceipt, GeneratedAiRecipe } from "@/types/saved-ai-recipe";
export class AiReceiptError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status=status; this.code=code; }
}

const lifetime = 7 * 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function secret() {
  const value = process.env.AI_RECIPE_SIGNING_SECRET?.trim();
  if (!value || Buffer.byteLength(value) < 32) throw new AiReceiptError(503, "SIGNING_UNAVAILABLE", "AI receptų išsaugojimas šiuo metu nesukonfigūruotas.");
  return value;
}
function invalid(): never { throw new AiReceiptError(400, "INVALID_RECEIPT", "AI rezultatas pakeistas arba netinkamas. Išsaugoti jo negalima."); }
function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && !!value.trim() && [...value].length <= max;
}
function validate(value: unknown): asserts value is GeneratedAiRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const data = value as GeneratedAiRecipe;
  if (Object.keys(data).sort().join() !== ["version","generationId","originalMealId","originalTitle","situation","options","text","generatedAt"].sort().join() ||
      data.version !== 1 || typeof data.generationId !== "string" || !uuid.test(data.generationId) ||
      typeof data.originalMealId !== "string" || !/^\d{1,10}$/.test(data.originalMealId) ||
      !validText(data.originalTitle,24000) || !validText(data.situation,2000) || !validText(data.text,100000) ||
      !data.options || typeof data.options !== "object" || Object.keys(data.options).sort().join() !== "goal,minutes,people" ||
      ![15,30,60].includes(data.options.minutes) || ![1,2,4].includes(data.options.people) || !Object.hasOwn(goals,data.options.goal) ||
      typeof data.generatedAt !== "string" || !Number.isFinite(Date.parse(data.generatedAt))) invalid();
  const time = Date.parse(data.generatedAt);
  if (new Date(time).toISOString() !== data.generatedAt || time > Date.now() + 60000) invalid();
  if (Date.now() - time > lifetime) throw new AiReceiptError(400,"RECEIPT_EXPIRED","Šio neišsaugoto rezultato 7 dienų galiojimas pasibaigė.");
}

export function signAiRecipe(input: Omit<GeneratedAiRecipe,"version"|"generationId"|"generatedAt">): AiReceipt {
  const key = secret();
  const data = { ...input, version: 1 as const, generationId: randomUUID(), generatedAt: new Date().toISOString() };
  validate(data);
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return { payload, signature: createHmac("sha256",key).update(payload).digest("hex") };
}

export function verifyAiReceipt(receipt: unknown): GeneratedAiRecipe {
  const key = secret();
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || Object.keys(receipt).sort().join() !== "payload,signature") invalid();
  const {payload,signature} = receipt as AiReceipt;
  if (typeof payload !== "string" || payload.length > 900000 || !/^[A-Za-z0-9_-]+$/.test(payload) ||
      typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) invalid();
  const expected = createHmac("sha256",key).update(payload).digest();
  if (!timingSafeEqual(expected,Buffer.from(signature,"hex"))) invalid();
  let data: unknown;
  try { data = JSON.parse(Buffer.from(payload,"base64url").toString("utf8")); } catch { invalid(); }
  validate(data);
  return data;
}
