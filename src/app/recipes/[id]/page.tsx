import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeById } from "@/lib/themealdb";
import SaveRecipeControl from "@/components/SaveRecipeControl";
import RecipeRescueForm from "@/components/RecipeRescueForm";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let recipe;
  try {
    recipe = await getRecipeById(id);
  } catch {
    return (
      <main className="shell recipe-page">
        <Link className="back-link" href="/">← Grįžti į paiešką</Link>
        <section className="notice error" role="alert">
          <h1 className="state-title">Nepavyko įkelti recepto</h1>
          <p>Receptų paslauga šiuo metu nepasiekiama. Pabandyk dar kartą.</p>
          <a className="back-link" href={`/recipes/${encodeURIComponent(id)}`}>Bandyti dar kartą</a>
        </section>
      </main>
    );
  }
  if (!recipe) notFound();

  return (
    <main className="shell recipe-page">
      <Link className="back-link" href="/">← Grįžti į paiešką</Link>
      <article>
        <header className="recipe-header">
          <p className="eyebrow">RECEPTO ID · {recipe.id}</p>
          <h1>{recipe.title}</h1>
          <SaveRecipeControl mealId={recipe.id} />
          <dl className="recipe-meta">
            <div><dt>Kategorija</dt><dd>{recipe.category || "Nenurodyta"}</dd></div>
            <div><dt>Kilmės šalis / regionas</dt><dd>{recipe.area || "Nenurodyta"}</dd></div>
          </dl>
        </header>
        <div className="recipe-overview">
          <img className="recipe-photo" src={recipe.imageUrl} alt={recipe.title} width={700} height={700} />
          <section className="ingredients-panel" aria-labelledby="ingredients-title">
            <h2 id="ingredients-title">Ingredientai ir kiekiai</h2>
            {recipe.ingredients.length ? <ul className="ingredient-list">
              {recipe.ingredients.map((ingredient, index) => <li key={index}>
                <span>{ingredient.name}</span><span className="ingredient-measure">{ingredient.measure || "Kiekis nenurodytas"}</span>
              </li>)}
            </ul> : <p>Ingredientai nenurodyti.</p>}
          </section>
        </div>
        <section className="instructions-panel" aria-labelledby="instructions-title">
          <h2 id="instructions-title">Gaminimo instrukcija</h2>
          <p className="recipe-instructions">{recipe.instructions || "Gaminimo instrukcija nenurodyta."}</p>
        </section>
      </article>
      <RecipeRescueForm key={recipe.id} recipeId={recipe.id} />
      <footer>Receptų šaltinis: <a href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a></footer>
    </main>
  );
}
