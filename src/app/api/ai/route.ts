import { AiError, generateAiText } from "@/lib/gemini";
import { aiLimiter, AiLimiterUnavailable } from "@/lib/ai-rate-limit";
import { prepareRecipeAdaptation } from "@/lib/recipe-adaptation";
import { signAiRecipe } from "@/lib/ai-recipe-signing";
import { createHash } from "node:crypto";
import { defaultAiOptions, goals, type AiOptions } from "@/types/ai-options";

export const runtime = "nodejs";
// Application budget, including Redis, recipe lookup and the 30s Gemini deadline.
export const maxDuration = 60;

function methodNotAllowed() {
  const response = failure(405, "METHOD_NOT_ALLOWED", "Naudokite POST metodą.");
  response.headers.set("Allow", "POST");
  return response;
}
export { methodNotAllowed as GET, methodNotAllowed as HEAD, methodNotAllowed as PUT,
  methodNotAllowed as PATCH, methodNotAllowed as DELETE, methodNotAllowed as OPTIONS };

function failure(status: number, code: string, message: string, retryAfter?: number) {
  return Response.json({ error: { code, message } }, {
    status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}

type AiInput = { prompt: string } | { recipeId: string; situation: string; options: AiOptions; preview: boolean; previewHash?: string };

async function readInput(request: Request): Promise<AiInput> {
  const tooLarge = () => new AiError(413, "BODY_TOO_LARGE", "Užklausa per didelė (iki 16 KB).");
  if (Number(request.headers.get("content-length")) > 16384) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new AiError(400, "INVALID_INPUT", "Pateikite tekstinį prompt lauką.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); void reader.cancel().catch(() => {}); }, 10_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw new AiError(408, "BODY_TIMEOUT", "Užklausos duomenys siunčiami per ilgai.");
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { void reader.cancel().catch(() => {}); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AiError(400, "INVALID_JSON", "Pateikite tinkamą JSON užklausą."); }
  if (!body || Array.isArray(body) || typeof body !== "object") {
    throw new AiError(400, "INVALID_INPUT", "Pateikite tinkamus užklausos laukus.");
  }
  const keys = Object.keys(body);
  // Preserve task 12's standalone test contract; do not allow mixed or extra fields.
  if (keys.length === 1 && typeof body.prompt === "string") {
    const prompt = body.prompt.trim();
    if (!prompt || [...prompt].length > 2000) throw new AiError(400, "INVALID_INPUT", "Įveskite tekstą nuo 1 iki 2000 simbolių.");
    return { prompt };
  }
  if (keys.some(key => !["recipeId", "situation", "options", "preview", "previewHash"].includes(key)) || typeof body.recipeId !== "string" || !/^\d{1,10}$/.test(body.recipeId) || typeof body.situation !== "string") {
    throw new AiError(400, "INVALID_INPUT", "Pateikite recepto ID ir savo situaciją.");
  }
  const situation = body.situation.trim();
  if (!situation || [...situation].length > 2000) throw new AiError(400, "INVALID_INPUT", "Aprašykite situaciją nuo 1 iki 2000 simbolių.");
  const options = body.options === undefined ? defaultAiOptions : body.options;
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).length !== 3 ||
      ![15,30,60].includes(options.minutes) || ![1,2,4].includes(options.people) ||
      typeof options.goal !== "string" || !Object.hasOwn(goals, options.goal) ||
      (body.preview !== undefined && typeof body.preview !== "boolean") ||
      (body.previewHash !== undefined && (typeof body.previewHash !== "string" || !/^[a-f0-9]{64}$/.test(body.previewHash)))) {
    throw new AiError(400, "INVALID_OPTIONS", "Pasirinkite tinkamą laiką, žmonių skaičių ir tikslą.");
  }
  return { recipeId: body.recipeId, situation, options, preview: body.preview === true, previewHash: body.previewHash };
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) {
    return failure(403, "ORIGIN_FORBIDDEN", "Užklausa iš šio puslapio neleidžiama.");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return failure(415, "UNSUPPORTED_MEDIA_TYPE", "Naudokite application/json turinio tipą.");
  }
  // App Router provides no trusted peer IP here. Ignore spoofable proxy headers.
  // Preserve the conservative shared bucket across ALL instances; no IP spoofing.
  let permit;
  try { permit = await aiLimiter.acquire("shared"); }
  catch { return failure(503, "AI_LIMITER_UNAVAILABLE", new AiLimiterUnavailable().message); }
  if ("retryAfter" in permit) return failure(429, "AI_RATE_LIMITED", "Per daug užklausų arba užklausa jau vyksta. Palaukite.", permit.retryAfter);
  try {
    const input = await readInput(request);
    const prepared = "prompt" in input ? null : await prepareRecipeAdaptation(input.recipeId, input.situation, input.options);
    const prompt = "prompt" in input ? input.prompt : prepared!.prompt;
    if (!("prompt" in input)) {
      const previewHash = createHash("sha256").update(prompt).digest("hex");
      if (input.preview) return Response.json({ prompt, previewHash }, { headers: { "Cache-Control": "no-store" } });
      if (input.previewHash && input.previewHash !== previewHash) throw new AiError(409, "PROMPT_CHANGED", "Recepto duomenys pasikeitė. Peržiūrėkite prompt iš naujo.");
    }
    const text = await generateAiText(prompt);
    if (!("prompt" in input) && prepared) {
      try {
        const receipt = signAiRecipe({originalMealId:prepared.originalMealId,originalTitle:prepared.originalTitle,
          situation:input.situation,options:input.options,text});
        return Response.json({text,receipt},{headers:{"Cache-Control":"no-store"}});
      } catch {
        // A signing/configuration failure must not discard a paid generation.
        return Response.json({text,saveUnavailable:true},{headers:{"Cache-Control":"no-store"}});
      }
    }
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiError) return failure(error.status, error.code, error.message);
    return failure(502, "AI_UNAVAILABLE", "Nepavyko apdoroti AI užklausos. Pabandykite vėliau.");
  } finally { await permit.release(); }
}
