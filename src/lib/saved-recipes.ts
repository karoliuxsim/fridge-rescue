import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SavedRecipe } from "@/types/recipe";

export class SavedRecipesError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function savedRecipesContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) {
    throw new SavedRecipesError(503, "AUTH_UNAVAILABLE", "Nepavyko patikrinti prisijungimo. Bandykite dar kartą.");
  }
  if (error || !data.user) throw new SavedRecipesError(401, "AUTH_REQUIRED", "Prisijunkite, kad galėtumėte tvarkyti savo receptus.");
  return { supabase, userId: data.user.id };
}

export function databaseError(error: { code?: string; message?: string }): SavedRecipesError {
  if (error.code === "42501") {
    const schema = error.message?.includes("permission denied for schema");
    return new SavedRecipesError(403, schema ? "SCHEMA_ACCESS_DENIED" : "RECIPES_ACCESS_DENIED",
      "Supabase nesuteikė prieigos prie išsaugotų receptų (42501). Reikia patikrinti authenticated teises ir RLS; leidimai automatiškai nekeičiami.");
  }
  if (["PGRST205", "PGRST106", "42P01"].includes(error.code ?? "")) {
    return new SavedRecipesError(503, "RECIPES_NOT_EXPOSED", "Receptų lentelė nepasiekiama per Data API. Patikrinkite public schemos prieinamumą ir lentelės nustatymus.");
  }
  return new SavedRecipesError(503, "RECIPES_UNAVAILABLE", "Nepavyko pasiekti išsaugotų receptų. Bandykite dar kartą.");
}

export async function listSavedRecipes({ supabase, userId }: Awaited<ReturnType<typeof savedRecipesContext>>) {
  const { data, error } = await supabase.from("saved_recipes")
    .select("id,meal_id,title,image_url,created_at").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw databaseError(error);
  return data as SavedRecipe[];
}

export function savedResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function savedErrorResponse(error: unknown) {
  const safe = error instanceof SavedRecipesError ? error : databaseError({});
  return savedResponse({ error: safe.message, code: safe.code }, safe.status);
}

export function checkMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new SavedRecipesError(403, "INVALID_ORIGIN", "Užklausa turi būti siunčiama iš šios aplikacijos.");
  }
}
