import Link from "next/link";
import { redirect } from "next/navigation";
import { savedRecipesContext, SavedRecipesError, databaseError } from "@/lib/saved-recipes";
import { listAiRecipes } from "@/lib/saved-ai-recipes";
import AiRecipeList from "@/components/AiRecipeList";

export default async function Page(){
  let recipes;
  try{recipes=await listAiRecipes(await savedRecipesContext());}
  catch(error){
    if(error instanceof SavedRecipesError&&error.status===401)redirect("/login");
    const safe=error instanceof SavedRecipesError?error:databaseError({});
    return <main className="shell my-recipes"><h1>Mano AI receptai</h1><p role="alert" className="notice error">{safe.message}</p><a href="/my-ai-recipes">Bandyti dar kartą</a></main>;
  }
  return <main className="shell my-recipes"><Link className="back-link" href="/">← Grįžti į paiešką</Link><h1>Mano AI receptai</h1><AiRecipeList initialRecipes={recipes}/></main>;
}
