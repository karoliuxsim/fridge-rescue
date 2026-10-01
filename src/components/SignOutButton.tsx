"use client";

import { useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

export default function SignOutButton() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await signOut();
      if (result.error) setError(result.error);
      else { window.location.assign("/"); return; }
    } catch { setError("Nepavyko atsijungti. Bandykite dar kartą."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div><button onClick={logout} disabled={busy}>{busy ? "Atsijungiama..." : "Atsijungti"}</button>{error && <p className="error" role="alert">{error}</p>}</div>;
}
