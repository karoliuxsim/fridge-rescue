# Fridge Rescue – projekto būklė

Atnaujinta: 2026-09-28. Būklė paremta šio pokalbio atliktais darbais, įrankių rezultatais ir vartotojo patvirtinimais.

## Svarbiausia kitam DI agentui

Projektas jau sukurtas ir veikia. Nepradėti iš naujo. Dabartinis etapas – 18 užduoties PRE-DEPLOY kodo paruošimas, užbaigtas be publikavimo. Vartotojas prieš 15 užduotį patvirtino sėkmingą AI atsakymą; žemiau palikta 13 užduoties 503 diagnostikos istorija nėra dabartinio sutrikimo patvirtinimas.

APP_URL perkeltas į serverio konfigūraciją; AI ribotuvas pakeistas bendru Upstash Redis. Tikro Redis nekūrėme ir netestavome. `.env.local`, Supabase ir Vercel nustatymai nepakeisti. Laukti vartotojo leidimo tęsti konfigūravimą/deploy. Be Redis kintamųjų AI ir prompt peržiūra sąmoningai grąžina 503. Production autentifikacijai reikalingas HTTPS APP_URL. Gemini generavimo ir 19 užduoties leidimo nėra.

UZDUOTYS.md nukopijuotas visas vartotojo pokalbyje pateiktas 19 užduočių ir papildomos užduoties sąrašas, o ne išorinis dėstytojo dokumentas. Vėlesni vartotojo techniniai patikslinimai aprašomi šiame būklės faile.

## Užduočių būsena

| Nr. | Būsena ir patikrinimas |
| --- | --- |
| 1 | Atlikta mokymosi užduotis; vartotojas patvirtino. |
| 2 | Planas parengtas ir vartotojo patvirtintas. Darbai vykdomi po vieną užduotį. |
| 3 | Atlikta. Tikra ingredientų paieška; vartotojas naršyklėje patikrino chicken, beef, salmon. |
| 4 | Atlikta. Recepto puslapis pagal ID, visi duomenys, grįžimas, nerasto recepto ir API klaidos. Patikrintas 52940. |
| 5 | Atlikta. Paieška pagal pavadinimą ir ingredientą; tuščia įvestis, nerasti rezultatai, įkėlimas, API klaidos, dubliavimo ir senų atsakymų apsauga. Patikrinta automatiškai ir naršyklėje. |
| 6 | Atlikta. Supabase klientai prijungti; tikras Auth nustatymų ryšio testas HTTP 200. |
| 7 | Atlikta. Registracija, el. pašto patvirtinimas, prisijungimas, atsijungimas, sesijos išsaugojimas; vartotojo rankinis patvirtinimas ir imituoti automatiniai testai. |
| 8 | Atlikta. Išsaugojimas, „Mano receptai“, pašalinimas, serverio vartotojo patikra. Vartotojas patvirtino A recepto išsaugojimą. |
| 9 | Dalinai patikrinta gyvai. Vartotojas patvirtino, kad B Safari Private lange nemato A duomenų net perkrovus. Tikras anoniminis SELECT atmestas. Tiesioginiai A/B duomenų bazės SELECT, DELETE ir svetimo user_id INSERT testai agento neatlikti; paruoštas saugus interaktyvus įrankis. Nežymėti visų gyvų RLS testų kaip atliktų. |
| 10 | Atlikta. GEMINI_API_KEY netuščias, be NEXT_PUBLIC_ priešdėlio; rakto kode nerasta; .env.local ignoruojamas. .env.example tik tuščias kintamasis. Patikros metu Git saugyklos nebuvo. |
| 11 | Atlikta. @google/genai SDK ir scripts/test-gemini.ts; gemini-3.8-flash metaduomenys ir tikras sakinys apie picą sėkmingi. |
| 12 | Atlikta ir patvirtinta vartotojo. POST /api/ai viename tikrame bandyme grąžino HTTP 200 ir netuščią tekstą apie picą. Rakto atsakyme bei užfiksuotuose žurnaluose nebuvo. Kiti bandymai buvo 503; tai neprieštarauja užfiksuotam sėkmingam bandymui. |
| 13 | Įgyvendinta. Vartotojas prieš 15 užduotį patvirtino, kad matė tikrą AI sugeneruotą atsakymą. Ankstesnės 503 klaidos buvo laikinos; šiame etape generavimo nekartojome. |
| 14 | Įgyvendinta. Laiko, žmonių skaičiaus ir tikslo pasirinkimai, serverio validacija, tikslaus prompt peržiūra be Gemini kvietimo. 50 serverio ir 15 naršyklės testų, TypeScript ir build sėkmingi. Tikrų generavimo užklausų šiame etape nesiųsta. |
| 15 | Atlikta. Pasirašytas serverio receipt su HMAC, tik prisijungęs vartotojas gali išsaugoti AI rezultatą, veikia „Mano AI receptai“, detalė, pašalinimas ir savininko/RLS patikros. Nekviečia Gemini pakartotinai. `test:auth` 17, `test:e2e` 15, `test:ai` 61, `test:rls` 9, `typecheck` ir `build` sėkmingi. |
| 16 | Pirmas diagnostikos etapas atliktas izoliuotais testais. Gemini 401/403, 429/RESOURCE_EXHAUSTED, saugūs žurnalai, TheMealDB HTTP/JSON/struktūros klaidos, atsijungusio vartotojo AI GET/POST/DELETE ir vartotojų A/B AI įrašų atskyrimas patikrinti. Tikri Gemini, gyvi A/B RLS ir tikri Supabase klaidų scenarijai šiame etape nevykdyti. |
| 17 | Atlikta. Globalus, pagal nutylėjimą išjungtas Developer Mode; naršyklės API užklausų 6 laukų lentelė, 30 įrašų, išvalymas, saugios fiksuotos endpoint žymos. test:developer 11, test:e2e 19, test:auth 17, TypeScript ir build sėkmingi. Vidinės serverio užklausos neįtrauktos. |
| 18 | PRE-DEPLOY kodas paruoštas: serverio APP_URL, bendras Upstash ribotuvas, Node.js 24.x, aplikacijos maxDuration=60. Testai ir build sėkmingi. Tikras Redis ir Vercel deploy neatlikti, dashboardai nekeisti. |
| 19 | Neatlikta. Galutinis viešos aplikacijos A/B testas dar negalimas. |
| Papildoma | „Mano virtuvė“ neįgyvendinta. |

## Architektūra ir svarbūs failai

- Next.js App Router, TypeScript, React; priklausomybių versijos – package.json ir package-lock.json. Įdiegtas @google/genai 2.24.0.
- src/lib/themealdb.ts – serverio TheMealDB paieška ir getRecipeById, naudojantis lookup.php?i=...; ID tik skaitmenys, iki 10 simbolių, užklausa su 15 s riba.
- src/app/recipes/[id]/page.tsx – originalus receptas, išsaugojimo valdiklis ir nauja AI forma.
- src/components/RecipeRescueForm.tsx – „Mano situacija“, „✨ Pritaikyti receptą“, „Pritaikomas receptas...“, aiškios klaidos ir atskiras AI tekstas. Prisijungimas neprivalomas. Pakartotiniai vienalaikiai siuntimai blokuojami. AI tekstas rodomas kaip tekstas, ne HTML.
- src/app/api/ai/route.ts – priima arba ankstesnį { prompt }, arba { recipeId, situation }. Mišrūs ir papildomi laukai atmetami. Situacija iki 2000 simbolių, kūnas iki 16 KB. Naršyklė neperduoda originalaus recepto ar modelio. Atsakymas { text } arba { error: { code, message } }, Cache-Control: no-store.
- src/lib/recipe-adaptation.ts – serveris gauna tikrą receptą ir sudaro lietuvišką prompt su pavadinimu, ingredientais, kiekiais, instrukcija ir situacija. Didesni nei 24000 simbolių surinkti duomenys atmetami, o ne nukerpami.
- src/lib/gemini.ts – server-only modulis, pagrindinis modelis gemini-3.8-flash. GEMINI_API_KEY skaitomas serveryje. maxOutputTokens: 1024; 30 s laukimo riba; retryOptions.attempts: 1. Saugūs žurnalai leidžia tik klaidos tipą, leistiną kodą ir HTTP statusą.
- src/lib/ai-rate-limit.ts – bendri Upstash Redis skaitikliai ir atominiai 90 s užraktai. Ribos 5/min. ir 1 aktyvi užklausa vienam raktui, 20/min. ir 2 visai aplikacijai. Endpoint visiems naudoja shared raktą, taigi efektyviai 5/min. ir 1 aktyvi užklausa visoms instancijoms kartu. Redis sutrikus 503, limito atveju 429. Origin tikrinamas; jo nebuvimas leidžiamas terminalo testams.
- src/lib/supabase/{config,client,server,proxy}.ts ir src/proxy.ts – jau veikianti Supabase SSR integracija; serverio vartotojas tikrinamas getUser, naudojama vartotojo sesija.
- src/app/auth/confirm/route.ts – el. pašto patvirtinimo grįžimas; palaiko PKCE kodą ir token_hash. Adresai sudaromi iš serverio src/lib/app-url.ts; production reikalauja HTTPS APP_URL, development numatyta localhost:3001.
- src/app/api/saved-recipes, src/app/my-recipes ir src/lib/saved-recipes.ts – jau veikiantis originalių receptų išsaugojimas. Nekurti jų iš naujo.

## Supabase ir saugumas

- Vartotojas jau įvykdė supabase/migrations/001_saved_recipes.sql. Nekartoti migracijos, netrinti ir nekurti saved_recipes iš naujo.
- saved_recipes turi RLS, SELECT / INSERT / DELETE taisykles tik savininkui. UPDATE leidimo nėra. Vienas user_id ir meal_id derinys unikalus.
- Tik authenticated rolė turi SELECT / INSERT / DELETE teises. Anoniminė tiesioginė užklausa gavo HTTP 401, PostgreSQL kodą 42501; tai numatytas apribojimas, ne priežastis suteikti anon teises.
- Anksčiau valdymo skydelyje rodytas „API DISABLED“ žymėjimas. Globalus Data API įjungtas; vartotojo originalių receptų išsaugojimas vėliau patvirtintas. Vien žyma neįrodo dabartinio leidimų gedimo.
- Gyviems tiesioginiams A/B RLS testams žr. docs/rls-testing.md ir scripts/test-rls-live.mjs. Įrankis prašo vartotojo prisijungti atskiruose naršyklės kontekstuose ir testuoja tik naujus laikinus įrašus. Tikrų slaptažodžių ar žetonų agentas neturi.
- Nekeisti .env.local; nerodyti raktų, slaptažodžių, sesijos žetonų ar visų SDK klaidų objektų. Nenaudoti service_role. Neišjungti RLS ir nekeisti DB leidimų be vartotojo patvirtinimo.

## Gemini diagnostikos rezultatai ir ribos

Pagrindinis modelis lieka gemini-3.8-flash. Ankstesni 11 ir 12 užduočių trumpi generavimo bandymai buvo sėkmingi. 13 užduoties užklausose buvo tikras receptas Brown Stew Chicken (52940) ir situacija „Neturiu svogūnų. Kuo galėčiau juos pakeisti?“.

Pakartotinių, atskirai vartotojo autorizuotų bandymų metu SDK grąžino ApiError, HTTP 503, UNAVAILABLE. Endpoint pagal numatytą apdorojimą grąžino HTTP 502 AI_UNAVAILABLE. Vienas bandymas baigėsi per 2,47 s, kitas 4,9 s, todėl jų nesukėlė 30 s timeout. Originalus receptas išliko nepakeistas. 429 kvotos klaida neužfiksuota. Tikslus vidinis Google sutrikimo mechanizmas nežinomas; nevadinti jo įrodytu visuotiniu sutrikimu ar konkrečia kvotos problema.

Oficialios dokumentacijos patikrinimo metu modelis buvo stabilus, išjungimo data nepaskelbta. Google AI Studio būsenos puslapis rodė „All Systems Operational“, nors konkrečios mūsų užklausos grąžino 503. SDK generavimo struktūra ir parametrai atitiko dokumentaciją. Statusas laikinas – prireikus tikrinti iš naujo, o ne laikyti šį įrašą dabartinės paslaugos garantija.

Paskutinė autorizuota alternatyvos diagnostika:

- Modelis gemini-3.5-flash-lite rastas oficialiame kataloge.
- To paties projekto modelio metaduomenų užklausa grąžino HTTP 200 ir patvirtino modelio tapatybę.
- Tik vienas laikinas generavimas, naudojant esamą serverio prompt sudarymo funkciją ir tą pačią recepto situaciją, grąžino HTTP 503 UNAVAILABLE (ApiError). Atsakymo teksto negauta.
- Alternatyva naudota tik atskirame atmintyje vykdytame diagnostiniame teste. Pagrindinis endpoint, modelis, .env.local ir ribotuvai nepakeisti. Diagnostinis testas neišsaugotas kaip projekto failas.
- Metaduomenų HTTP 200 patvirtina modelio matomumą, bet negarantuoja generavimo pajėgumų tuo metu. Nėra pagrindo teigti, kad 503 būdingas tik pagrindiniam modeliui.

Oficialūs šaltiniai:

- https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/docs/deprecations
- https://aistudio.google.com/status
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html
- https://googleapis.github.io/js-genai/release_docs/interfaces/types.HttpRetryOptions.html

## Atlikti testai ir paleidimas

Istorinis 13 užduoties patikrinimas (dabartinės 18 užduoties patikros pateiktos žemiau):

| Patikra | Rezultatas |
| --- | --- |
| npm run test:ai | 37 sėkmingi imituoti serverio testai; nenaudoja tikro Gemini rakto ar generavimo. |
| npm run test:e2e | 14 sėkmingų Playwright testų; tikras TheMealDB, AI atsakymai imituoti. Apima originalo išlaikymą, anoniminę formą, laukimą, klaidas, vieną siuntimą, mobilų vaizdą ir ankstesnę paiešką. |
| npm run test:auth | 12 sėkmingų Playwright testų su imituota Supabase; tai nėra gyvi RLS testai. |
| npm run typecheck | Sėkminga. |
| npm run build | Sėkmingas. |
| npm run test:rls | Ankstesniame 9 užduoties etape 9 sėkmingi imituoti testai; iš naujo 13 užduotyje nevykdyti. |
| Tikras 13 užduoties bandymas naršyklėje | 1 POST; HTTP 502 dėl Gemini 503; originalas nepakito, klaida parodyta. |
| Tikras alternatyvos bandymas | Modelio metaduomenys HTTP 200; 1 generavimo užklausa HTTP 503. |

Vietinis adresas: http://localhost:3001/recipes/52940. Ankstesnėje darbo sesijoje aplikacija buvo paleista production režimu per `npm run start -- --hostname 127.0.0.1 --port 3001`. Proceso buvimą kitai sesijai reikia patikrinti; nepasikliauti senais PID ar įrankių sesijų numeriais. Po naujo build jau veikiantį production serverį reikia perkrauti, kad būtų naudojamas naujas kodas. Kurti ir paleisti naują projektą nereikia.

`npm run test:gemini` siunčia tikrą generavimo užklausą. Nesupainioti su imituotu `npm run test:ai`. Nenaudoti jo kaip įprastos regresinės patikros be vartotojo leidimo. Naršyklės mygtukas taip pat siunčia tikrą užklausą. Jokio automatinio generavimo pakartojimo ar modelių kaitaliojimo.

## Nuo ko tęsti

1. Perskaityti šį failą, UZDUOTYS.md ir README 18 užduoties dalį. Neperkurti projekto.
2. Laukti vartotojo patvirtinimo prieš tikro Upstash sukūrimą, Vercel deploy ar Supabase dashboard pakeitimus. Reikalingų septynių kintamųjų pavadinimai yra README ir .env.example; reikšmių nerodyti.
3. Redis patikrinti tik gavus leidimą; tam pakanka prompt peržiūros be Gemini generavimo. Production APP_URL suderinti su Supabase Site URL ir Redirect URLs.
4. Nepaleisti test:gemini ar naršyklės generavimo be atskiro vartotojo leidimo. Modelio, .env.local, RLS ir lentelių nekeisti savavališkai.
5. Gyvi A/B RLS bandymai dar nepatvirtinti; imituoti testai nėra jų pakaitalas. 19 užduočiai reikia atskiro leidimo.

## 18 užduoties patikros

Typecheck ir build sėkmingi. AI 62, rate limiter 9, APP_URL 13, auth 17, E2E 19, Developer Mode 11, TheMealDB 6, imituoti RLS 9 testai sėkmingi. Tikro Upstash ryšio ir Vercel veikimo dar netestavome. Gemini nesiųsta. Redis vienetiniai testai imituoja skaitiklius ir užraktus; Lua nebuvo vykdomas tikrame Redis. API išlaiko konservatyvų bendrą 5/min. ir vienos vykstančios užklausos limitą visiems lankytojams; tai ne per-IP ribojimas.

## 17 užduoties architektūra

`src/lib/browser-api-diagnostics.ts` – klientinė atminties saugykla ir fetch funkcija; `src/components/DeveloperMode.tsx` – bendro layout jungiklis ir lentelė. Esami klientiniai komponentai naudoja diagnosticFetch su fiksuotais operacijų pavadinimais. Jautrūs laukai nerenkami, globalus fetch neperrašomas, tinklo elgesys nekeičiamas. Testai: scripts/browser-api-diagnostics.test.mjs ir tests/developer-mode.spec.ts. Rankinės patikros ir ribos – README 17 užduoties dalyje.

## Naujausia 18 užduoties patikra – 2026-10-01

Ši pastaba pakeičia ankstesnį teiginį, kad tikras Redis dar netestuotas. Vartotojas sukūrė Upstash ir įrašė REST kintamuosius į `.env.local`. Tikras PING/write/read/delete bei dabar ir izoliuotas aplikacijos limiterio testas sėkmingi. `scripts/test-rate-limit-live.mjs` naudoja tikrą POST funkciją, tikrą Upstash ir Lua, Gemini modulį imituoja ir tinklą riboja tik Redis origin. Tai tiesioginis handler testas, ne Vercel HTTP testas.

5/min: 200, 200, 200, 200, 200, 429 tame pačiame minutės lange. Concurrent: aktyvios užklausos metu 429, jos užbaigimas 200, kita po release 200. `AI_RATE_LIMITED` ir Retry-After patikrinti. Pašalinti tik 4 TEST ONLY raktai; liko 0, TTL patikrintas. Tikrų Gemini kvietimų 0. `createAiLimiter` papildytas pasirenkamu validuojamu vidiniu TEST ONLY prefiksu; įprasto singleton konfigūracija nepakito. Naujas regresinis prefikso testas, rate-limit 10/10 ir AI 62/62, typecheck sėkmingi. `.env.local`, Supabase, RLS nepakeisti. Laukti vartotojo leidimo kitam žingsniui; deploy ir 19 užduotis neatlikti.
