import "server-only";

// Never derive authentication destinations from user-controlled request headers.
export function getAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  const production = process.env.NODE_ENV === "production";
  if (!raw && !production) return "http://localhost:3001";
  try {
    if (!raw) throw new Error();
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
        (production ? url.protocol !== "https:" || local :
          url.protocol !== "https:" && !(url.protocol === "http:" && local))) throw new Error();
    return url.origin;
  } catch {
    throw new Error("Netinkamas APP_URL: nurodykite aplikacijos HTTPS adresą be kelio ir parametrų.");
  }
}

export function getAuthConfirmUrl(): string {
  return new URL("/auth/confirm", getAppUrl()).href;
}
