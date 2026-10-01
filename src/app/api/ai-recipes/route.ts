import { savedRecipesContext, savedResponse, savedErrorResponse, checkMutationOrigin } from "@/lib/saved-recipes";
import { listAiRecipes, saveAiRecipe, readAiSaveBody } from "@/lib/saved-ai-recipes";

export async function GET() {
  try {const context=await savedRecipesContext();return savedResponse({recipes:await listAiRecipes(context),userId:context.userId});}
  catch(error){return savedErrorResponse(error);}
}
export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const context=await savedRecipesContext();
    const result=await saveAiRecipe(context,await readAiSaveBody(request));
    return savedResponse(result,result.alreadySaved?200:201);
  } catch(error){return savedErrorResponse(error);}
}
