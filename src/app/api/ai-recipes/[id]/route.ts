import { savedRecipesContext, savedResponse, savedErrorResponse, checkMutationOrigin } from "@/lib/saved-recipes";
import { getAiRecipe, deleteAiRecipe } from "@/lib/saved-ai-recipes";

type Params = { params: Promise<{ id: string }> };
export async function GET(_request: Request,{params}: Params) {
  try {return savedResponse({recipe:await getAiRecipe(await savedRecipesContext(),(await params).id)});}
  catch(error){return savedErrorResponse(error);}
}
export async function DELETE(request: Request,{params}: Params) {
  try {checkMutationOrigin(request);await deleteAiRecipe(await savedRecipesContext(),(await params).id);return savedResponse({deleted:true});}
  catch(error){return savedErrorResponse(error);}
}
