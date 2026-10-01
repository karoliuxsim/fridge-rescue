import { GoogleGenAI, ApiError } from "@google/genai";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

// Standalone Node script only: never import this file into the application.
const model = "gemini-3.8-flash";
const prompt = "Parašyk vieną sakinį apie picą.";

const help: Record<number, string> = {
  400: "Neteisinga užklausa arba netinkamas API raktas. Patikrinkite rakto būseną Google AI Studio, jo neviešindami.",
  401: "Autentifikacija atmesta. Patikrinkite, ar Google AI Studio raktas galiojantis ir priklauso numatytam projektui.",
  403: "Prieiga uždrausta. Google AI Studio / Google Cloud patikrinkite projekto API prieigą ir rakto apribojimus; jų aklai neišjunkite.",
  404: "Modelis arba išteklius nerastas šioje API versijoje / projekte. Patikrinkite oficialų modelių katalogą. Modelis automatiškai nekeičiamas.",
  429: "Viršyta užklausų arba naudojimo kvota. Patikrinkite projekto limitus ir atsiskaitymo būseną Google AI Studio; palaukite prieš bandydami vėl.",
};

async function main() {
  try {
    loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
  } catch {
    console.error("Nepavyko nuskaityti .env.local. Failo turinys nerodomas.");
    process.exitCode = 1;
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("GEMINI_API_KEY nėra arba jis tuščias.");
    process.exitCode = 1;
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } },
  });
  let stage = "modelio prieinamumo patikra";
  console.log(`Modelis: ${model}`);
  try {
    // Metadata lookup uses this project's key; generation is attempted only on success.
    await ai.models.get({ model });
    console.log("Modelio metaduomenų užklausa: pavyko.");
    stage = "bandomojo atsakymo generavimas";
    const response = await ai.models.generateContent({ model, contents: prompt });
    const answer = response.text?.trim();
    if (!answer) {
      console.error("API atsakė, bet tekstas tuščias. Testas nepavyko; automatiškai nekartojamas.");
      process.exitCode = 1;
      return;
    }
    // Defense in depth: never print the key, even if it unexpectedly appears in text.
    console.log(`Bandomasis atsakymas: ${answer.split(apiKey).join("[PASLĖPTA]")}`);
    console.log("Tikras Gemini generavimo testas: pavyko.");
  } catch (error: unknown) {
    // Never log SDK errors, request URLs, headers, or stack traces: they can contain secrets.
    const status = error instanceof ApiError && Number.isInteger(error.status) ? error.status : undefined;
    console.error(`Nepavyko: ${stage}. HTTP kodas: ${status ?? "negautas"}.`);
    console.error(status ? (help[status] ?? "API klaida. Patikrinkite Google paslaugos būseną; testas automatiškai nekartojamas.") : "Tinklo arba SDK klaida. Patikrinkite tinklo prieigą. Slapti diagnostikos duomenys nerodomi.");
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error("Gemini testas nepavyko. Diagnostikos objektas nerodomas dėl rakto saugumo.");
  process.exitCode = 1;
});
