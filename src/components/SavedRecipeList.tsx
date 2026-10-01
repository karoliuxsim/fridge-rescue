"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";

import Link from "next/link";
import { useRef, useState } from "react";
import type { SavedRecipe } from "@/types/recipe";

export default function SavedRecipeList({ initialRecipes }: { initialRecipes: SavedRecipe[] }) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function remove(id: string) {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    setBusy([...pending.current]);
    setError("");
    setMessage("");
    try {
      const response = await diagnosticFetch("deleteOriginal", `/api/saved-recipes/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Nepavyko pašalinti recepto."); return; }
      setRecipes(current => current.filter(recipe => recipe.id !== id));
      setMessage("Receptas pašalintas.");
    } catch { setError("Nepavyko pašalinti recepto. Patikrinkite ryšį ir bandykite dar kartą."); }
    finally { pending.current.delete(id); setBusy([...pending.current]); }
  }
  return <>
    <p role="status">{message}</p>
    {error && <p role="alert" className="notice error">{error}</p>}
    {!recipes.length && <div className="notice"><p>Dar nėra išsaugotų receptų.</p><Link className="back-link" href="/">Ieškoti receptų</Link></div>}
    <div className="recipe-grid">{recipes.map(recipe => <article className="recipe-card saved-card" key={recipe.id}>
      <Link className="recipe-card-link" href={`/recipes/${recipe.meal_id}`} prefetch={false}>
        <img src={recipe.image_url} alt={recipe.title} width={400} height={300} loading="lazy" />
        <div className="recipe-content"><p className="recipe-id">RECEPTO ID · {recipe.meal_id}</p><h2>{recipe.title}</h2></div>
      </Link>
      <div className="saved-card-actions"><button disabled={busy.includes(recipe.id)} onClick={() => remove(recipe.id)} aria-label={`Pašalinti ${recipe.title}`}>{busy.includes(recipe.id) ? "Šalinama..." : "Pašalinti"}</button></div>
    </article>)}</div>
  </>;
}
