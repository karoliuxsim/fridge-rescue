import "server-only";
import type { RecipeSummary, RecipeDetails } from "@/types/recipe";

export async function getRecipeById(id: string): Promise<RecipeDetails | null> {
  if (!/^\d{1,10}$/.test(id)) return null;

  const url = new URL("https://www.themealdb.com/api/json/v1/1/lookup.php");
  url.searchParams.set("i", id);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("TheMealDB lookup failed");

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("meals" in data)) {
    throw new Error("Invalid TheMealDB response");
  }
  if (data.meals === null) return null;
  if (!Array.isArray(data.meals)) throw new Error("Invalid meal list");
  if (data.meals.length === 0) return null;

  const meal = data.meals[0] as Record<string, unknown> | null;
  if (!meal || typeof meal !== "object" || meal.idMeal !== id ||
      typeof meal.strMeal !== "string" || typeof meal.strMealThumb !== "string" ||
      typeof meal.strInstructions !== "string") {
    throw new Error("Invalid meal details");
  }

  const ingredients: RecipeDetails["ingredients"] = [];
  for (let index = 1; index <= 20; index++) {
    const name = meal[`strIngredient${index}`];
    const measure = meal[`strMeasure${index}`];
    if (typeof name === "string" && name.trim()) {
      ingredients.push({ name: name.trim(), measure: typeof measure === "string" ? measure.trim() : "" });
    }
  }

  return {
    id,
    title: meal.strMeal,
    imageUrl: meal.strMealThumb,
    category: typeof meal.strCategory === "string" ? meal.strCategory.trim() : "",
    area: typeof meal.strArea === "string" ? meal.strArea.trim() : "",
    ingredients,
    instructions: meal.strInstructions.trim(),
  };
}

export async function searchByIngredient(ingredient: string): Promise<RecipeSummary[]> {
  const url = new URL("https://www.themealdb.com/api/json/v1/1/filter.php");
  url.searchParams.set("i", ingredient.trim().replace(/\s+/g, "_"));
  return searchRecipes(url);
}

export async function searchByName(name: string): Promise<RecipeSummary[]> {
  const url = new URL("https://www.themealdb.com/api/json/v1/1/search.php");
  url.searchParams.set("s", name.trim());
  return searchRecipes(url);
}

async function searchRecipes(url: URL): Promise<RecipeSummary[]> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("TheMealDB request failed");

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("meals" in data)) {
    throw new Error("Invalid TheMealDB response");
  }
  if (data.meals === null) return [];
  if (!Array.isArray(data.meals)) throw new Error("Invalid meal list");

  return data.meals.map((meal: unknown) => {
    if (!meal || typeof meal !== "object" ||
        !("idMeal" in meal) || typeof meal.idMeal !== "string" ||
        !("strMeal" in meal) || typeof meal.strMeal !== "string" ||
        !("strMealThumb" in meal) || typeof meal.strMealThumb !== "string") {
      throw new Error("Invalid meal");
    }
    return { id: meal.idMeal, title: meal.strMeal, imageUrl: meal.strMealThumb };
  });
}
