import "server-only";
import { savedRecipesContext, SavedRecipesError, databaseError } from "@/lib/saved-recipes";
import { AiReceiptError, verifyAiReceipt } from "@/lib/ai-recipe-signing";
import type { SavedAiRecipe } from "@/types/saved-ai-recipe";

type Context = Awaited<ReturnType<typeof savedRecipesContext>>;
const fields = "id,generation_id,original_meal_id,original_title,situation,minutes,people,goal,ai_text,generated_at,created_at";
export function validateAiId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new SavedRecipesError(400,"INVALID_ID","Netinkamas įrašo ID.");
}
export async function listAiRecipes({supabase,userId}: Context) {
  const {data,error} = await supabase.from("saved_ai_recipes").select(fields).eq("user_id",userId).order("created_at",{ascending:false});
  if (error) throw databaseError(error);
  return data as SavedAiRecipe[];
}
export async function getAiRecipe({supabase,userId}: Context,id: string) {
  validateAiId(id);
  const {data,error} = await supabase.from("saved_ai_recipes").select(fields).eq("user_id",userId).eq("id",id).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new SavedRecipesError(404,"AI_RECIPE_NOT_FOUND","AI receptas nerastas.");
  return data as SavedAiRecipe;
}
export async function saveAiRecipe({supabase,userId}: Context,receipt: unknown) {
  let result;
  try { result = verifyAiReceipt(receipt); }
  catch(error) { if (error instanceof AiReceiptError) throw new SavedRecipesError(error.status,error.code,error.message); throw error; }
  const {data,error} = await supabase.from("saved_ai_recipes").insert({
    user_id:userId,generation_id:result.generationId,original_meal_id:result.originalMealId,original_title:result.originalTitle,
    situation:result.situation,minutes:result.options.minutes,people:result.options.people,goal:result.options.goal,
    ai_text:result.text,generated_at:result.generatedAt,
  }).select("id").single();
  if (error?.code === "23505") {
    const existing = await supabase.from("saved_ai_recipes").select("id").eq("user_id",userId).eq("generation_id",result.generationId).maybeSingle();
    if (existing.error) throw databaseError(existing.error);
    if (existing.data) return {id:existing.data.id as string,alreadySaved:true};
  }
  if (error) throw databaseError(error);
  return {id:data!.id as string,alreadySaved:false};
}
export async function deleteAiRecipe({supabase,userId}: Context,id: string) {
  validateAiId(id);
  const {data,error} = await supabase.from("saved_ai_recipes").delete().eq("user_id",userId).eq("id",id).select("id");
  if (error) throw databaseError(error);
  if (!data?.length) throw new SavedRecipesError(404,"AI_RECIPE_NOT_FOUND","AI receptas nerastas.");
}

export async function readAiSaveBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new SavedRecipesError(415,"INVALID_CONTENT_TYPE","Naudokite JSON formatą.");
  const limit=1024*1024;
  const tooLarge=()=>new SavedRecipesError(413,"BODY_TOO_LARGE","Išsaugomas rezultatas per didelis.");
  if (Number(request.headers.get("content-length"))>limit) throw tooLarge();
  const reader=request.body?.getReader();
  if (!reader) throw new SavedRecipesError(400,"INVALID_INPUT","Trūksta rezultato.");
  let size=0, expired=false;
  const chunks: Uint8Array[]=[];
  const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>{});},10000);
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(expired) throw new SavedRecipesError(408,"BODY_TIMEOUT","Užklausa siunčiama per ilgai.");
      if(done) break;
      size+=value.byteLength;
      if(size>limit){void reader.cancel().catch(()=>{});throw tooLarge();}
      chunks.push(value);
    }
  } finally {clearTimeout(timer);reader.releaseLock();}
  let body;
  try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new SavedRecipesError(400,"INVALID_INPUT","Netinkamas JSON.");}
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).join()!=="receipt") throw new SavedRecipesError(400,"INVALID_INPUT","Pateikite tik pasirašytą rezultatą.");
  return body.receipt as unknown;
}
