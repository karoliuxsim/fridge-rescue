"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { authenticate } from "@/app/auth/actions";
import { validateCredentials } from "@/lib/auth";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const invalid = validateCredentials(String(data.get("email") ?? "").trim(), String(data.get("password") ?? ""), registering);
    setError("");
    setMessage("");
    if (invalid) { setError(invalid); return; }
    pending.current = true;
    setBusy(true);
    try {
      const result = await authenticate(mode, data);
      if (result.error) setError(result.error);
      else if (result.signedIn) { window.location.assign("/"); return; }
      else { setMessage(result.message ?? ""); form.reset(); }
    } catch {
      setError("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <section className="auth-panel" aria-label={registering ? "Registracijos forma" : "Prisijungimo forma"}>
    <h1 className="state-title">{registering ? "Sukurti paskyrą" : "Prisijungti"}</h1>
    <p className="hint">{registering ? "Po registracijos reikės patvirtinti el. paštą." : "Prisijunk prie savo Fridge Rescue paskyros."}</p>
    <form onSubmit={submit} noValidate>
      <label htmlFor="email">El. paštas</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} />
      <label htmlFor="password">Slaptažodis</label>
      <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} maxLength={128} required disabled={busy} aria-describedby={registering ? "password-help" : undefined} />
      {registering && <p id="password-help" className="hint">Bent 8 simboliai. Supabase gali reikalauti ir sudėtingesnio slaptažodžio.</p>}
      <button type="submit" disabled={busy}>{busy ? "Palaukite..." : registering ? "Registruotis" : "Prisijungti"}</button>
    </form>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <p className="auth-switch">{registering ? "Jau turi paskyrą? " : "Dar neturi paskyros? "}<Link href={registering ? "/login" : "/register"}>{registering ? "Prisijungti" : "Registruotis"}</Link></p>
  </section>;
}
