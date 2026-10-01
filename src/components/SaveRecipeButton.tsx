"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";

import Link from "next/link";
import { useRef, useState } from "react";

export default function SaveRecipeButton({ mealId, initialSaved, initialError = "" }: { mealId: string; initialSaved: boolean; initialError?: string }) {
  const pending = useRef(false);
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [needsLogin, setNeedsLogin] = useState(false);
  async function save() {
    if (pending.current || saved) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await diagnosticFetch("saveOriginal", "/api/saved-recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mealId }) });
      const data = await response.json();
      if (!response.ok) {
        setNeedsLogin(response.status === 401);
        setError(data.error || "Nepavyko išsaugoti recepto.");
      } else { setSaved(true); }
    } catch { setError("Nepavyko išsaugoti recepto. Patikrinkite ryšį ir bandykite dar kartą."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="save-control">
    <button onClick={save} disabled={busy || saved || needsLogin}>{busy ? "Saugoma..." : saved ? "❤️ Išsaugota" : "❤️ Išsaugoti"}</button>
    <span role="status" className="hint">{saved ? "Receptas yra tavo sąraše „Mano receptai“." : ""}</span>
    {error && <p role="alert" className="notice error">{error}</p>}
    {needsLogin && <Link href="/login">Prisijungti</Link>}
  </div>;
}
