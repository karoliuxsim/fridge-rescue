import { savedRecipesContext, databaseError, SavedRecipesError, savedResponse, savedErrorResponse, checkMutationOrigin } from "@/lib/saved-recipes";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkMutationOrigin(request);
    const { supabase, userId } = await savedRecipesContext();
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new SavedRecipesError(400, "INVALID_INPUT", "Netinkamas įrašo ID.");
    }
    const { data, error } = await supabase.from("saved_recipes").delete().eq("id", id).eq("user_id", userId).select("id");
    if (error) throw databaseError(error);
    if (!data?.length) throw new SavedRecipesError(404, "NOT_FOUND", "Įrašas nerastas.");
    return savedResponse({ deleted: true });
  } catch (error) { return savedErrorResponse(error); }
}
