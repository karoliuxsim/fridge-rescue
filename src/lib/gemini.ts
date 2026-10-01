import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";

// Only fixed, allowlisted labels and numeric HTTP statuses may reach logs.
// Never log message, stack, cause, request headers or the original error object.
export function safeAiDiagnostic(error: unknown) {
  const knownCodes = new Set(["INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "NOT_FOUND",
    "RESOURCE_EXHAUSTED", "INTERNAL", "UNAVAILABLE", "DEADLINE_EXCEEDED",
    "ENOTFOUND", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]);
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : {};
  let code = [record.code, cause.code].find(value => typeof value === "string" && knownCodes.has(value));
  if (error instanceof ApiError && typeof error.message === "string") {
    try {
      const parsed = JSON.parse(error.message);
      if (typeof parsed?.error?.status === "string" && knownCodes.has(parsed.error.status)) code = parsed.error.status;
    } catch { /* Non-JSON SDK messages are deliberately discarded. */ }
  }
  const type = error instanceof ApiError ? "ApiError" : error instanceof TypeError ? "TypeError"
    : error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? error.name
    : error instanceof Error ? "Error" : "UnknownError";
  const status = error instanceof ApiError && Number.isInteger(error.status) && error.status >= 100 && error.status <= 599
    ? error.status : null;
  return { type, code: code ?? "UNKNOWN", status };
}

export class AiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
  }
}

export async function generateAiText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new AiError(503, "AI_NOT_CONFIGURED", "AI paslauga dar nesukonfigūruota.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } } });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiError(504, "AI_TIMEOUT", "AI atsakymo laukta per ilgai. Pabandykite vėliau."));
      }, 30_000);
    });
    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-3.8-flash", contents: prompt,
        config: { maxOutputTokens: 1024, abortSignal: controller.signal },
      }), timeout,
    ]);
    const text = response.text?.trim();
    if (!text) throw new AiError(502, "AI_EMPTY_RESPONSE", "AI negrąžino teksto. Pabandykite vėliau.");
    return text.split(apiKey).join("[PASLĖPTA]");
  } catch (error) {
    if (error instanceof AiError) throw error;
    console.error("Gemini failure", safeAiDiagnostic(error));
    if (controller.signal.aborted || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) {
      throw new AiError(504, "AI_TIMEOUT", "AI atsakymo laukta per ilgai. Pabandykite vėliau.");
    }
    const status = error instanceof ApiError ? error.status : undefined;
    if (status === 401 || status === 403) throw new AiError(502, "AI_AUTH_ERROR", "AI paslaugos prieigos klaida. Kreipkitės į aplikacijos administratorių.");
    if (status === 404) throw new AiError(502, "AI_MODEL_UNAVAILABLE", "Pasirinktas AI modelis neprieinamas.");
    if (status === 429) throw new AiError(429, "AI_QUOTA_EXCEEDED", "Pasiektas AI paslaugos naudojimo limitas. Pabandykite vėliau.");
    throw new AiError(502, "AI_UNAVAILABLE", "Nepavyko gauti AI atsakymo. Pabandykite vėliau.");
  } finally { clearTimeout(timer); }
}
