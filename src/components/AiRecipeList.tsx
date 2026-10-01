"use client";
import { diagnosticFetch } from "@/lib/browser-api-diagnostics";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { goals } from "@/types/ai-options";
import type { SavedAiRecipe } from "@/types/saved-ai-recipe";

export function DeleteAiRecipeButton({id,onDeleted}: {id:string;onDeleted?:()=>void}) {
  const router=useRouter();const lock=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function remove(){
    if(lock.current)return;lock.current=true;setBusy(true);setError("");
    try{
      const response=await diagnosticFetch("deleteAi", `/api/ai-recipes/${id}`,{method:"DELETE"});const data=await response.json();
      if(!response.ok){setError(data.error||"Nepavyko pašalinti.");return;}
      if(onDeleted)onDeleted();else{router.push("/my-ai-recipes");router.refresh();}
    }catch{setError("Nepavyko pašalinti. Patikrink ryšį ir bandyk dar kartą.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <><button onClick={remove} disabled={busy}>{busy?"Šalinama...":"Pašalinti AI receptą"}</button>{error&&<p className="notice error" role="alert">{error}</p>}</>;
}
export default function AiRecipeList({initialRecipes}: {initialRecipes:SavedAiRecipe[]}) {
  const [recipes,setRecipes]=useState(initialRecipes);const [message,setMessage]=useState("");
  return <><p role="status">{message}</p>{!recipes.length&&<p className="notice">Dar nėra išsaugotų AI receptų.</p>}
    <div className="recipe-grid">{recipes.map(recipe=><article className="recipe-card" key={recipe.id}>
      <div className="recipe-content"><h2><Link href={`/my-ai-recipes/${recipe.id}`} prefetch={false}>{recipe.original_title}</Link></h2>
        <p>{recipe.minutes} min. · {recipe.people} asm. · {goals[recipe.goal]}</p>
        <p className="hint">Išsaugota: {new Date(recipe.created_at).toLocaleDateString("lt-LT")}</p>
        <DeleteAiRecipeButton id={recipe.id} onDeleted={()=>{setRecipes(current=>current.filter(item=>item.id!==recipe.id));setMessage("AI receptas pašalintas.");}}/>
      </div></article>)}</div></>;
}
