import Link from "next/link";
import { savedRecipesContext, SavedRecipesError, databaseError } from "@/lib/saved-recipes";
import SaveRecipeButton from "./SaveRecipeButton";

export default async function SaveRecipeControl({ mealId }: { mealId: string }) {
  try {
    const { supabase, userId } = await savedRecipesContext();
    const { data, error } = await supabase.from("saved_recipes").select("id").eq("user_id", userId).eq("meal_id", mealId).maybeSingle();
    return <SaveRecipeButton mealId={mealId} initialSaved={Boolean(data)} initialError={error ? databaseError(error).message : ""} />;
  } catch (error) {
    if (error instanceof SavedRecipesError && error.status === 401) return <p><Link className="back-link" href="/login">Prisijunk, kad išsaugotum</Link></p>;
    return <p className="notice error" role="alert">Nepavyko patikrinti prisijungimo. Perkraukite puslapį ir bandykite dar kartą.</p>;
  }
}
