"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { defaultAiOptions, goals, type AiOptions } from "@/types/ai-options";
import SaveAiRecipeButton from "./SaveAiRecipeButton";
import type { AiReceipt } from "@/types/saved-ai-recipe";

const messages: Record<string, string> = {
  INVALID_OPTIONS: "Pasirink tinkamą laiką, žmonių skaičių ir tikslą.",
  PROMPT_CHANGED: "Originalus receptas pasikeitė. Peržiūrėk galutinį prompt iš naujo.",
  INVALID_INPUT: "Aprašyk savo situaciją (nuo 1 iki 2000 simbolių).",
  AI_RATE_LIMITED: "Užklausa jau vyksta arba pasiektas užklausų limitas. Palauk ir bandyk vėliau.",
  AI_QUOTA_EXCEEDED: "Pasiektas AI paslaugos naudojimo limitas. Pabandyk vėliau.",
  AI_AUTH_ERROR: "AI paslaugos prieigos klaida. Pabandyk vėliau.",
  AI_UNAVAILABLE: "AI paslauga laikinai nepasiekiama. Pabandyk vėliau.",
  AI_TIMEOUT: "AI atsakymo laukta per ilgai. Pabandyk vėliau.",
  AI_NOT_CONFIGURED: "AI paslauga šiuo metu neparuošta.",
  AI_MODEL_UNAVAILABLE: "AI modelis šiuo metu neprieinamas. Pabandyk vėliau.",
  RECIPE_NOT_FOUND: "Originalus receptas nerastas.",
  RECIPE_UNAVAILABLE: "Nepavyko gauti originalaus recepto. Pabandyk vėliau.",
  RECIPE_TOO_LARGE: "Šis receptas per ilgas AI pritaikymui.",
};

export default function RecipeRescueForm({ recipeId }: { recipeId: string }) {
  const [situation, setSituation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [receipt,setReceipt]=useState<AiReceipt|null>(null);
  const [options, setOptions] = useState<AiOptions>(defaultAiOptions);
  const [preview, setPreview] = useState<{ prompt: string; previewHash: string } | null>(null);
  const [operation, setOperation] = useState<"preview" | "generate">("generate");
  function invalidate() { setPreview(null); setError(""); }
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(false);
  }

  async function send(previewOnly: boolean) {
    if (active.current) return;
    const value = situation.trim();
    if (!value || [...value].length > 2000) { setError(messages.INVALID_INPUT); return; }
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setOperation(previewOnly ? "preview" : "generate"); setError("");
    if (previewOnly) setPreview(null); else {setText("");setReceipt(null);}
    // Covers the existing 15s recipe lookup plus the 30s Gemini deadline.
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await diagnosticFetch(previewOnly ? "preview" : "generate", "/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, situation: value, options, ...(previewOnly ? { preview: true } : preview ? { previewHash: preview.previewHash } : {}) }), signal: controller.signal,
      });
      const data = await response.json();
      if (active.current !== controller) return;
      if (!response.ok) {
        if (data?.error?.code === "PROMPT_CHANGED") setPreview(null);
        setError(messages[data?.error?.code] ?? "Nepavyko pritaikyti recepto. AI paslauga šiuo metu nepasiekiama. Pabandyk vėliau.");
      } else if (previewOnly) {
        if (typeof data?.prompt === "string" && data.prompt.trim() && typeof data?.previewHash === "string") setPreview({ prompt: data.prompt, previewHash: data.previewHash });
        else setError("Nepavyko gauti prompt peržiūros. Pabandyk vėliau.");
      } else if (typeof data?.text !== "string" || !data.text.trim()) {
        setError("AI negrąžino pritaikyto recepto. Pabandyk vėliau.");
      } else {
        setText(data.text);
        setReceipt(typeof data.receipt?.payload==="string"&&typeof data.receipt?.signature==="string"?data.receipt:null);
      }
    } catch {
      if (active.current === controller) setError(controller.signal.aborted
        ? "Atsakymo laukta per ilgai. Pabandyk vėliau."
        : "Nepavyko susisiekti su serveriu. Patikrink interneto ryšį ir bandyk vėliau.");
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setPending(false); }
    }
  }

  return <section className="rescue-panel" aria-labelledby="rescue-title">
    <h2 id="rescue-title">AI recepto gelbėtojas</h2>
    <p className="description">Trūksta ingrediento ar nori ką nors pakeisti? Aprašyk savo situaciją.</p>
    <form onSubmit={submit} aria-busy={pending} noValidate>
      <label htmlFor="recipe-situation">Mano situacija</label>
      <textarea id="recipe-situation" value={situation} maxLength={2000} rows={4} disabled={pending}
        onChange={event => { setSituation(event.target.value); invalidate(); }}
        aria-describedby="situation-hint" placeholder="Pavyzdžiui: neturiu svogūnų. Kuo galėčiau juos pakeisti?" />
      <p id="situation-hint" className="hint">Iki 2000 simbolių. Prisijungti nereikia.</p>
      <div className="rescue-options">
        <div><label htmlFor="rescue-minutes">Laikas</label>
          <select id="rescue-minutes" disabled={pending} value={options.minutes} onChange={event => { setOptions({ ...options, minutes: Number(event.target.value) as AiOptions["minutes"] }); invalidate(); }}>
            {[15,30,60].map(value => <option key={value} value={value}>{value} min.</option>)}
          </select></div>
        <div><label htmlFor="rescue-people">Žmonių skaičius</label>
          <select id="rescue-people" disabled={pending} value={options.people} onChange={event => { setOptions({ ...options, people: Number(event.target.value) as AiOptions["people"] }); invalidate(); }}>
            {[1,2,4].map(value => <option key={value} value={value}>{value}</option>)}
          </select></div>
        <div><label htmlFor="rescue-goal">Tikslas</label>
          <select id="rescue-goal" disabled={pending} value={options.goal} onChange={event => { setOptions({ ...options, goal: event.target.value as AiOptions["goal"] }); invalidate(); }}>
            {Object.entries(goals).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
      </div>
      <button type="button" disabled={pending} onClick={() => void send(true)}>Peržiūrėti galutinį prompt</button>{" "}
      <button type="submit" disabled={pending}>✨ Pritaikyti receptą</button>
    </form>
    {pending && <p role="status">{operation === "preview" ? "Ruošiama prompt peržiūra..." : "Pritaikomas receptas..."}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div aria-live="polite">
      {preview && <section className="rescue-result" aria-labelledby="prompt-title">
        <h3 id="prompt-title">Galutinis prompt</h3>
        <p className="hint">Peržiūra negeneruoja AI atsakymo. Pakeitus įvestį ją reikės atnaujinti.</p>
        <pre className="recipe-instructions">{preview.prompt}</pre>
      </section>}
      {text && <section className="rescue-result" aria-labelledby="rescue-result-title">
        <h3 id="rescue-result-title">AI pritaikytas receptas</h3>
        <p className="recipe-instructions">{text}</p>
        {receipt?<SaveAiRecipeButton key={receipt.signature} receipt={receipt}/>:<p className="hint">Šio atsakymo išsaugojimas nepasiekiamas: nėra serverio patvirtinto rezultato.</p>}
      </section>}
    </div>
  </section>;
}
