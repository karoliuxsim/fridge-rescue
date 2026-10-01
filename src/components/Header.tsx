import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function Header() {
  let email: string | null = null;
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) email = data.user.email ?? "Vartotojas";
    else if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) unavailable = true;
  } catch { unavailable = true; }
  return <header className="shell site-header">
    <Link className="brand brand-link" href="/"><span className="brand-mark" aria-hidden="true">fr.</span> Fridge Rescue</Link>
    <nav aria-label="Pagrindinė navigacija">
      <Link href="/">Paieška</Link>
      {email ? <><Link href="/my-recipes" prefetch={false}>Mano receptai</Link><Link href="/my-ai-recipes" prefetch={false}>Mano AI receptai</Link><span className="auth-state">Prisijungęs: {email}</span><SignOutButton /></> : <>
        <span className="auth-state">{unavailable ? "Nepavyko patikrinti sesijos" : "Neprisijungęs"}</span>
        <Link href="/login">Prisijungti</Link><Link href="/register">Registruotis</Link>
      </>}
    </nav>
  </header>;
}
