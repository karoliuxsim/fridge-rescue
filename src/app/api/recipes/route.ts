import { NextRequest, NextResponse } from "next/server";
import { searchByIngredient, searchByName } from "@/lib/themealdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Keep the original ingredient URL working for existing callers.
  const mode = params.get("mode") ?? "ingredient";
  const query = (params.get("q") ?? params.get("ingredient"))?.trim();
  if (mode !== "ingredient" && mode !== "name") {
    return NextResponse.json({ error: "Pasirinkite tinkamą paieškos būdą." }, { status: 400 });
  }
  if (!query || query.length > 100) {
    return NextResponse.json({ error: "Įveskite paieškos tekstą (iki 100 simbolių)." }, { status: 400 });
  }

  try {
    const recipes = await (mode === "ingredient" ? searchByIngredient(query) : searchByName(query));
    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json(
      { error: "Nepavyko gauti receptų. Pabandykite dar kartą." },
      { status: 502 },
    );
  }
}
