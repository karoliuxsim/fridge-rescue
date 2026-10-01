export type RecipeSummary = {
  id: string;
  title: string;
  imageUrl: string;
};

export type RecipeDetails = RecipeSummary & {
  category: string;
  area: string;
  ingredients: { name: string; measure: string }[];
  instructions: string;
};

export type SavedRecipe = {
  id: string;
  meal_id: string;
  title: string;
  image_url: string;
  created_at: string;
};
