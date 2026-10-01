import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/", "/login", "/register", "/recipes/:path*", "/my-recipes", "/my-ai-recipes/:path*"],
};
