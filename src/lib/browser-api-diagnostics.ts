"use client";

// Only these fixed labels can enter the diagnostic store. Never retain URLs,
// request/response bodies, headers, errors, IDs, prompts or signed receipts.
const operations = {
  search: { system: "Fridge Rescue → TheMealDB paieška", endpoint: "/api/recipes" },
  generate: { system: "Fridge Rescue → Gemini pritaikymas", endpoint: "/api/ai" },
  preview: { system: "Fridge Rescue – prompt peržiūra", endpoint: "/api/ai" },
  saveOriginal: { system: "Fridge Rescue → Supabase: išsaugoti receptą", endpoint: "/api/saved-recipes" },
  deleteOriginal: { system: "Fridge Rescue → Supabase: pašalinti receptą", endpoint: "/api/saved-recipes/[id]" },
  listAi: { system: "Fridge Rescue → Supabase: AI receptų sąrašas", endpoint: "/api/ai-recipes" },
  saveAi: { system: "Fridge Rescue → Supabase: išsaugoti AI receptą", endpoint: "/api/ai-recipes" },
  deleteAi: { system: "Fridge Rescue → Supabase: pašalinti AI receptą", endpoint: "/api/ai-recipes/[id]" },
} as const;

export type ApiOperation = keyof typeof operations;
export type ApiDiagnostic = {
  id: number; system: string; endpoint: string; method: string;
  status: number | null; success: boolean; durationMs: number;
  outcome: "response" | "network-error" | "aborted";
};
type Snapshot = { enabled: boolean; entries: readonly ApiDiagnostic[] };
const initial: Snapshot = { enabled: false, entries: [] };
let snapshot = initial;
let epoch = 0;
let sequence = 0;
const listeners = new Set<() => void>();
function publish(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) { try { listener(); } catch { /* Diagnostics cannot fail a request. */ } }
}
export const getDiagnostics = () => snapshot;
export const getServerDiagnostics = () => initial;
export function subscribeDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setDiagnosticsEnabled(enabled: boolean) {
  epoch++;
  publish({ enabled, entries: [] });
}
export function clearDiagnostics() {
  epoch++;
  publish({ enabled: snapshot.enabled, entries: [] });
}

export async function diagnosticFetch(operation: ApiOperation, input: string, init?: RequestInit): Promise<Response> {
  if (!snapshot.enabled) return fetch(input, init);
  const started = performance.now();
  const requestEpoch = epoch;
  function record(status: number | null, success: boolean, outcome: ApiDiagnostic["outcome"]) {
    try {
      if (!snapshot.enabled || epoch !== requestEpoch || !Object.hasOwn(operations, operation)) return;
      const rawMethod = (init?.method ?? "GET").toUpperCase();
      const method = ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(rawMethod) ? rawMethod : "Kitas";
      const elapsed = performance.now() - started;
      const entry: ApiDiagnostic = { id: ++sequence, ...operations[operation], method, status, success,
        durationMs: Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0, outcome };
      publish({ enabled: true, entries: [entry, ...snapshot.entries].slice(0,30) });
    } catch { /* Never log raw diagnostics or change fetch behavior. */ }
  }
  try {
    const response = await fetch(input, init);
    record(response.status, response.ok, "response");
    return response;
  } catch (error) {
    const aborted = init?.signal?.aborted || (error instanceof Error && error.name === "AbortError");
    record(null, false, aborted ? "aborted" : "network-error");
    throw error;
  }
}
