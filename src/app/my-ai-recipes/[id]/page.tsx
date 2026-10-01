import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { savedRecipesContext, SavedRecipesError, databaseError } from "@/lib/saved-recipes";
import { getAiRecipe } from "@/lib/saved-ai-recipes";
import { DeleteAiRecipeButton } from "@/components/AiRecipeList";
import { goals } from "@/types/ai-options";

export default async function Page({params}:{params:Promise<{id:string}>}){
  let recipe;
  try{recipe=await getAiRecipe(await savedRecipesContext(),(await params).id);}
  catch(error){
    if(error instanceof SavedRecipesError&&error.status===401)redirect("/login");
    if(error instanceof SavedRecipesError&&[400,404].includes(error.status))notFound();
    const safe=error instanceof SavedRecipesError?error:databaseError({});
    return <main className="shell"><p role="alert" className="notice error">{safe.message}</p><Link href="/my-ai-recipes">Mano AI receptai</Link></main>;
  }
  return <main className="shell my-recipes"><Link className="back-link" href="/my-ai-recipes">← Mano AI receptai</Link>
    <h1>{recipe.original_title}</h1><p>AI pritaikytas receptas · {recipe.minutes} min. · {recipe.people} asm. · {goals[recipe.goal]}</p>
    <p className="hint">Sugeneruota: {new Date(recipe.generated_at).toLocaleString("lt-LT",{timeZone:"Europe/Vilnius"})} · Išsaugota: {new Date(recipe.created_at).toLocaleString("lt-LT",{timeZone:"Europe/Vilnius"})}</p>
    <section className="instructions-panel"><h2>Mano situacija</h2><p className="recipe-instructions">{recipe.situation}</p></section>
    <section className="rescue-result"><h2>AI pritaikytas receptas</h2><p className="recipe-instructions">{recipe.ai_text}</p></section>
    <p><Link href={`/recipes/${recipe.original_meal_id}`}>Originalus receptas · {recipe.original_meal_id}</Link></p>
    <DeleteAiRecipeButton id={recipe.id}/>
  </main>;
}
