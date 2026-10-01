import { getRecipeById } from "@/lib/themealdb";
import { savedRecipesContext, listSavedRecipes, databaseError, SavedRecipesError, savedResponse, savedErrorResponse, checkMutationOrigin } from "@/lib/saved-recipes";

export async function GET() {
  try { return savedResponse({ recipes: await listSavedRecipes(await savedRecipesContext()) }); }
  catch (error) { return savedErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const { supabase, userId } = await savedRecipesContext();
    let body;
    try { body = await request.json(); }
    catch { throw new SavedRecipesError(400, "INVALID_INPUT", "Netinkami recepto duomenys."); }
    if (!body || typeof body.mealId !== "string" || !/^\d{1,10}$/.test(body.mealId)) {
      throw new SavedRecipesError(400, "INVALID_INPUT", "Netinkamas recepto ID.");
    }
    let recipe;
    try { recipe = await getRecipeById(body.mealId); }
    catch { throw new SavedRecipesError(502, "RECIPE_API_UNAVAILABLE", "Nepavyko gauti originalaus recepto iš TheMealDB. Bandykite dar kartą."); }
    if (!recipe) throw new SavedRecipesError(404, "RECIPE_NOT_FOUND", "Receptas nerastas.");
    const { error } = await supabase.from("saved_recipes").insert({
      user_id: userId, meal_id: recipe.id, title: recipe.title, image_url: recipe.imageUrl,
    });
    if (error?.code === "23505") {
      // Confirm the existing row is visible to this user before reporting success.
      const existing = await supabase.from("saved_recipes").select("id").eq("user_id", userId).eq("meal_id", recipe.id).maybeSingle();
      if (existing.error) throw databaseError(existing.error);
      if (existing.data) return savedResponse({ saved: true, alreadySaved: true });
    }
    if (error) throw databaseError(error);
    return savedResponse({ saved: true }, 201);
  } catch (error) { return savedErrorResponse(error); }
}
