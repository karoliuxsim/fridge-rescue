"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { RecipeSummary } from "@/types/recipe";

export default function SearchForm() {
  const [mode, setMode] = useState<"ingredient" | "name">("ingredient");
  const [ingredient, setIngredient] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [searchedIngredient, setSearchedIngredient] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function clearSearch() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setError("");
    setRecipes([]);
    setSearchedIngredient("");
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current) return;
    const query = ingredient.trim();
    if (!query) {
      clearSearch();
      setError(mode === "ingredient" ? "Įveskite ingredientą." : "Įveskite patiekalo pavadinimą.");
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    setRecipes([]);
    setSearchedIngredient("");
    try {
      const params = new URLSearchParams({ mode, q: query });
      const response = await diagnosticFetch("search", `/api/recipes?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Nepavyko gauti receptų. Pabandykite dar kartą.");
      const data: { recipes: RecipeSummary[] } = await response.json();
      if (activeRequest.current !== controller || controller.signal.aborted) return;
      setRecipes(data.recipes);
      setSearchedIngredient(query);
    } catch {
      if (activeRequest.current !== controller || controller.signal.aborted) return;
      setError("Nepavyko gauti receptų. Patikrinkite ryšį ir pabandykite dar kartą.");
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <>
      <form className="search-panel" onSubmit={search} noValidate>
        <label htmlFor="search-mode">Paieškos būdas</label>
        <select id="search-mode" value={mode} onChange={(event) => {
          clearSearch();
          setMode(event.target.value as "ingredient" | "name");
          setIngredient("");
        }}>
          <option value="ingredient">Pagal ingredientą</option>
          <option value="name">Pagal patiekalo pavadinimą</option>
        </select>
        <label htmlFor="ingredient">{mode === "ingredient" ? "Kokį ingredientą turi?" : "Kokio patiekalo ieškai?"}</label>
        <div className="search-row">
          <input id="ingredient" name="ingredient" value={ingredient} onChange={(event) => { clearSearch(); setIngredient(event.target.value); }} placeholder={mode === "ingredient" ? "Pavyzdžiui, chicken" : "Pavyzdžiui, Arrabiata"} maxLength={100} required aria-describedby="ingredient-help" aria-invalid={error ? true : undefined} />
          <button type="submit" disabled={loading}>{loading ? "Ieškoma..." : "Ieškoti"}<span aria-hidden="true"> →</span></button>
        </div>
        <p id="ingredient-help" className="hint">{mode === "ingredient" ? "Ingredientą įrašyk angliškai: chicken, beef arba salmon." : "Patiekalo pavadinimą įrašyk angliškai, pavyzdžiui, Arrabiata."}</p>
      </form>

      <section className="results" aria-label="Paieškos rezultatai" aria-busy={loading}>
        <div role="status" aria-live="polite">
          {loading && <p className="notice">Ieškoma...</p>}
          {searchedIngredient && <div className="results-heading"><h2>{mode === "ingredient" ? "Receptai su" : "Paieška:"} „{searchedIngredient}“</h2><span>Rasta: {recipes.length}</span></div>}
          {searchedIngredient && recipes.length === 0 && <p className="notice">Receptų nerasta</p>}
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {!loading && !error && !searchedIngredient && <div className="empty-state"><span className="empty-symbol" aria-hidden="true">✳</span><h2>{mode === "ingredient" ? "Kas šiandien tavo šaldytuve?" : "Ką norėtum pagaminti?"}</h2><p>{mode === "ingredient" ? "Pradėk nuo vieno ingrediento. Idėjomis pasirūpinsime mes." : "Įrašyk patiekalo pavadinimą ir atrask receptą."}</p></div>}
        <div className="recipe-grid">
          {recipes.map((recipe) => <article className="recipe-card" key={recipe.id}>
            <Link className="recipe-card-link" href={`/recipes/${encodeURIComponent(recipe.id)}`} prefetch={false}>
            <img src={recipe.imageUrl} alt={recipe.title} width={400} height={300} loading="lazy" />
            <div className="recipe-content"><p className="recipe-id">RECEPTO ID · {recipe.id}</p><h3>{recipe.title}</h3></div>
            </Link>
          </article>)}
        </div>
      </section>
    </>
  );
}
