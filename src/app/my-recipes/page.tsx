import Link from "next/link";
import { redirect } from "next/navigation";
import { savedRecipesContext, listSavedRecipes, SavedRecipesError, databaseError } from "@/lib/saved-recipes";
import SavedRecipeList from "@/components/SavedRecipeList";

export default async function MyRecipesPage() {
  let recipes;
  try {
    recipes = await listSavedRecipes(await savedRecipesContext());
  } catch (error) {
    if (error instanceof SavedRecipesError && error.status === 401) redirect("/login");
    const safe = error instanceof SavedRecipesError ? error : databaseError({});
    return <main className="shell my-recipes"><h1>Mano receptai</h1><p className="notice error" role="alert">{safe.message}</p><a className="back-link" href="/my-recipes">Bandyti dar kartą</a></main>;
  }
  return <main className="shell my-recipes"><Link className="back-link" href="/">← Grįžti į paiešką</Link><h1>Mano receptai</h1><SavedRecipeList initialRecipes={recipes} /></main>;
}
