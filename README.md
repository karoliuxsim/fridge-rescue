# Fridge Rescue

Įgyvendintos 1–17 užduočių funkcijos; gyvų RLS testų ribos aprašytos PROJECT_STATUS.md. 18 užduoties pre-deploy kodas paruoštas, publikavimas dar neatliktas.

## Paleidimas

Reikia Node.js 24.x ir npm.

1. `npm install`
2. `npm run dev -- --port 3001`
3. Atidaryti http://localhost:3001 (naudoti localhost, ne 127.0.0.1, kad sutaptų patvirtinimo adresas ir slapukai).

Patikrinimai: `npm run typecheck` ir `npm run build`.
Produkcijos režimas po surinkimo: `npm start -- --port 3001`. Jame autentifikacijai privalomas galiojantis HTTPS `APP_URL`; localhost HTTP numatytoji reikšmė galioja development režime. AI funkcijoms abiem režimais reikia Redis nustatymų (žr. 18 užduotį).

## Kaip veikia

- Naršyklėje pasirenkamas paieškos būdas, įvedamas angliškas ingredientas arba patiekalo pavadinimas ir spaudžiama „Ieškoti“.
- Ingredientui naudojamas `/api/recipes?mode=ingredient&q=chicken`, pavadinimui – `/api/recipes?mode=name&q=Arrabiata`.
- Next.js serveris atitinkamai kreipiasi į TheMealDB `filter.php?i=...` arba `search.php?s=...`. Senasis `/api/recipes?ingredient=chicken` adresas tebeveikia.
- Kortelėse rodomas pavadinimas, nuotrauka ir TheMealDB ID.
- Paspaudus kortelę atsidaro `/recipes/[id]`. Serverio komponentas tiesiogiai naudoja `getRecipeById` ir TheMealDB `lookup.php?i=...`; papildomos naršyklės API užklausos tam nereikia.
- Recepto puslapyje rodomi pavadinimas, nuotrauka, kategorija, kilmės šalis / regionas, ingredientai su kiekiais ir instrukcija.
- Tušti ingredientai praleidžiami. Jei kiekis nepateiktas, rodoma „Kiekis nenurodytas“.
- Mygtukas „Grįžti į paiešką“ veda į pagrindinį puslapį. Nerastam receptui rodoma 404 būsena, API sutrikimui – atskiras pranešimas ir pakartojimo nuoroda.
- Naudojamas TheMealDB mokymuisi skirtas raktas `1`; receptų paieškai `.env.local` nereikalingas. Supabase klientams reikalingi žemiau aprašyti nustatymai.
- Duomenų šaltinis: https://www.themealdb.com/api.php

## Rankinė patikra

Įvesti `chicken`, `beef` ir `salmon` po vieną. Kiekvienai paieškai turi pasirodyti tikro API grąžintos kortelės su nuotraukomis, pavadinimais ir ID.

Atidaryti kortelę pele arba klaviatūra. Taip pat tiesiogiai atidaryti `/recipes/52940`, perkrauti puslapį ir grįžti į paiešką. Patikrinti `/recipes/0` – turi būti rodoma „Receptas nerastas“.

9 užduoties saugumo patikros paruoštos; tikriems dviejų sesijų bandymams dar reikia vartotojo prisijungimo. 10–15 užduočių funkcijos patvirtintos vartotojo; 16 užduoties izoliuoti klaidų testai ir 17 užduotis atlikti. 18 užduotyje atliktas tik pre-deploy paruošimas.

## Atliktų patikrinimų rezultatai

- `npm run typecheck` – sėkmingai.
- `npm run build` – sėkmingai.
- Produkcinis serveris: pagrindinis puslapis grąžina HTTP 200 ir paieškos formą.
- `chicken` – 20 receptų, `beef` – 33, `salmon` – 8 (tikrinimo metu; API turinys gali keistis).
- Visų trijų paieškų ID, pavadinimai ir nuotraukų URL sutapo su tiesioginiais TheMealDB atsakymais.
- Kiekvienos paieškos pirmo recepto nuotrauka pasiekiama: HTTP 200, paveikslėlio turinio tipas.
- Tuščias ingredientas aplikacijos API grąžina HTTP 400.
- Patikrinta per HTTP; vizualinis naršyklės testas neatliktas.

### 4 užduoties patikrinimai

- `npm run build` ir `npm run typecheck` – sėkmingai.
- `/recipes/52940` – HTTP 200; „Brown Stew Chicken“, „Chicken“, „Jamaican“, visi 13 ingredientų su kiekiais ir visa instrukcija sutapo su tikru TheMealDB atsakymu.
- `/recipes/0` ir `/recipes/abc` – HTTP 404, lietuviškas nerasto recepto pranešimas ir grįžimo nuoroda.
- Izoliuotas duomenų gavimo funkcijos testas: netinkamas ID nesiunčia užklausos; null ir tuščias sąrašas reiškia nerastą receptą; tušti ingredientai praleidžiami, kiekiai suporuojami, patikrinamas ir 20-as ingredientų laukas.
- Imituoti nesėkmingas HTTP atsakymas, netinkami API duomenys ir tinklo klaida – funkcija tinkamai atmeta rezultatą.
- Pakartotinai patikrintos paieškos: chicken – 20, beef – 33, salmon – 8; visos HTTP 200.
- Recepto puslapis patikrintas per HTTP; vizualinis naršyklės testas neatliktas.

### 5 užduoties patikrinimai

- `npm run build` ir `npm run typecheck` – sėkmingai.
- `npm run test:e2e` – visi 8 Chromium testai praėjo.
- Tikras `chicken` atsakymas parodytas kortelėse; patikrintas 52940 recepto atidarymas ir grįžimas į paiešką.
- Tikras `Arrabiata` atsakymas – „Spicy Arrabiata Penne“, ID 52771, su nuotrauka ir recepto nuoroda.
- Tuščia ir vien tarpų įvestis abiem būdais rodo aiškų pranešimą, API užklausų skaičius – 0.
- Neegzistuojantis pavadinimas per tikrą API rodo „Receptų nerasta“.
- Naršyklėje imituoti API HTTP 502 ir tinklo sutrikimas: rodomas suprantamas pranešimas, paiešką galima kartoti.
- 5 greiti mygtuko paspaudimai ir 5 formos siuntimai vykdo tik vieną užklausą; matoma „Ieškoma...“ būsena.
- Dirbtinai pavėlintas senas atsakymas (net ignoruojant atšaukimo signalą) neperrašo naujesnių rezultatų.
- Pakeitus tekstą ar būdą, sena užklausa atšaukiama ir seni rezultatai išvalomi. Kortelių dizainas bendras abiem paieškoms.
- Patikrinta serverio įvesties validacija ir seno ingrediento API adreso suderinamumas.
- Atlikti naršyklės funkciniai testai ir peržiūrėtos darbalaukio bei 390 px pločio mobiliojo vaizdo ekrano nuotraukos. Atskirai patikrinta, kad receptų nuotraukos įsikrauna.

Naršyklės testų paleidimas: pirmą kartą `npx playwright install chromium`, tada `npm run build` ir `npm run test:e2e`. Testai paleidžia atskirą serverį 3105 prievade ir po darbo jį sustabdo. Tikrų paieškų testams reikia interneto ir veikiančio TheMealDB. Ekrano nuotraukos saugomos ignoruojamame `test-results/` aplanke.

## 6 užduotis: Supabase

Įdiegtos oficialios `@supabase/supabase-js` ir `@supabase/ssr` bibliotekos.

`.env.local` turi turėti netuščius `NEXT_PUBLIC_SUPABASE_URL` ir `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env.example` yra pavyzdys be reikšmių. Nenaudoti Secret ar service_role rakto. Failą `.env.local` ignoruoja `.gitignore` taisyklė `.env*`; patikrinimo metu projekto aplanke Git saugyklos nebuvo, todėl failas nebuvo sekamas Git.

- `src/lib/supabase/client.ts` – naršyklės klientas per `createBrowserClient`.
- `src/lib/supabase/server.ts` – serverio klientas per `createServerClient`, kiekvienai užklausai atskiras, su Next.js `cookies()` adapteriu.
- `src/lib/supabase/config.ts` – nustatymų validacija su klaidomis, kurios nerodo reikšmių.
- `npm run check:supabase` – tik skaitymo `GET /auth/v1/settings` su Publishable key antraštėje; išvedama tik saugi būsena, ne URL, raktas ar atsakymo turinys.

Publishable key skirtas ir naršyklės klientui; būsimos prieigos prie lentelių apsaugą užtikrins RLS. 6 užduotyje klientai buvo tik paruošti. 7 užduotyje pridėtas sesijos atnaujinimo Proxy ir serverio autentifikacijos veiksmai. Lentelių ir RLS taisyklių dar nėra.

### Patikrinimai

- Abu aplinkos kintamieji egzistuoja ir netušti; URL formatas ir Publishable key prefiksas tinkami. Tikros reikšmės neišvestos ir `.env.local` nekeistas.
- Tikras Supabase ryšio testas: HTTP 200 ir tinkamas Auth nustatymų atsakymas. Vykdyta tik GET užklausa, jokie duomenys nekurti.
- `npm run build` ir `npm run typecheck` – sėkmingai.
- `npm run test:e2e` – 9 testai praėjo: ankstesni 8 paieškos / recepto navigacijos testai bei konfigūracijos testas su sintetinėmis reikšmėmis (trūkstami ar tušti kintamieji, netinkamas URL, slapto rakto atmetimas ir saugus klaidos tekstas).

Pakeitus aplinkos kintamuosius perkrauti kūrimo serverį. Produkcijos režimui iš naujo atlikti `npm run build` ir paleisti `npm start`.

## 7 užduotis: registracija ir prisijungimas

- `/register` – el. paštas, slaptažodis ir Supabase Auth registracija.
- `/login` – prisijungimas su slaptažodžiu.
- Bendra navigacija rodo neprisijungusio arba serverio patikrinto vartotojo būseną ir leidžia atsijungti iš šios naršyklės sesijos.
- Formos naudoja Server Actions ir esamą Supabase serverio klientą. Slaptažodžiai ir sesijos negrąžinami formų atsakymuose ir nerašomi į mūsų žurnalus.
- `src/proxy.ts` ir `src/lib/supabase/proxy.ts` atnaujina sesiją, perduoda slapukus tiek puslapio užklausai, tiek naršyklės atsakymui. Asmeniniai puslapių atsakymai neleidžiami į bendrą podėlį.
- Serverio vartotojo patikra naudoja `getUser()`, kuris tikrina sesiją Supabase serveryje; vien slapuko duomenimis nepasitikima.
- `/auth/confirm` priima standartinio Supabase laiško PKCE `code` arba oficialaus SSR šablono `token_hash` su `type=email`. Po patikros žetonai pašalinami iš adreso, nukreipiama į patikrintą serverio APP_URL adresą. Išorinis `next` parametras ignoruojamas.
- Registracija siunčia `emailRedirectTo`, sudarytą iš serverio `APP_URL` ir `/auth/confirm`. Konfigūracija yra `src/lib/app-url.ts`; development numatyta `http://localhost:3001`.
- Vietinė registracijos taisyklė – bent 8 simbolių slaptažodis. Supabase gali taikyti griežtesnius reikalavimus.
- Rodomos saugios lietuviškos klaidos, įskaitant blogus prisijungimo duomenis, nepatvirtintą el. paštą, silpną slaptažodį ir užklausų limitą. Paskyros egzistavimas skelbiamas tik gavus aiškią Supabase klaidą; privatumo sumetimais paslėptas atsakymas neinterpretuojamas kaip patikimas paskyros egzistavimo įrodymas.

### Supabase nustatymai ir tikro laiško patikra

1. Email provider, Allow new users to sign up ir Confirm email turi būti įjungti.
2. Site URL: `http://localhost:3001`. Redirect URLs turi apimti `http://localhost:3001/auth/confirm`; tam tinka ir `http://localhost:3001/**`.
3. Su numatytuoju Confirm signup laiško `{{ .ConfirmationURL }}` šablonu papildomai keisti šablono nereikia. Laišką atidaryti toje pačioje naršyklėje, kurioje registruotasi: PKCE naudoja jos patvirtinimo slapuką.
4. Jei sąmoningai naudojamas oficialus SSR token_hash laiško šablonas, jo nuoroda turi būti `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. Šis variantas irgi palaikomas; projekto šablonas automatiškai nekeistas.
5. Atidaryti `/register`, įvesti savo tikrą el. paštą ir naują bent 8 simbolių slaptažodį. Paspaudus „Registruotis“, turi pasirodyti prašymas patvirtinti el. paštą.
6. Kol laiškas nepatvirtintas, pabandyti prisijungti: turi būti pranešimas apie nepatvirtintą el. paštą.
7. Paspausti naujausio laiško patvirtinimo nuorodą. Po sėkmingo patvirtinimo turi atsidaryti `http://localhost:3001/`, navigacijoje matytis prisijungimo būsena. Perkrauti puslapį – ji turi išlikti.
8. Paspausti „Atsijungti“, perkrauti puslapį – turi likti „Neprisijungęs“. Tada iš naujo prisijungti per `/login`.
9. Patikrinti neteisingą slaptažodį ir greitus paspaudimus. Jei patvirtinimo nuoroda pasibaigusi ar jau panaudota, rodoma klaida su tolesniais veiksmais. Jei el. paštas jau patvirtintas, galima prisijungti slaptažodžiu.

Jei laiškas neateina, patikrinti šlamšto aplanką, Supabase siuntimo limitus ir leistinus gavėjus / SMTP nustatymus. Tikro laiško pristatymas automatiniais testais nepatvirtintas.

### 7 užduoties testai

- `npm run build` ir `npm run typecheck` – praėjo.
- `npm run test:e2e` – 9 ankstesni testai praėjo (tikra TheMealDB paieška, peržiūra, klaidų būsenos ir Supabase konfigūracija).
- `npm run test:auth` – 6 Chromium testai praėjo: registracija ir PKCE; prisijungimas, perkrovimas ir atsijungimas; validacija ir nepatvirtintas paštas; Supabase klaidos ir privatumas; token_hash bei blogos / pakartotinės nuorodos; sesijos atnaujinimas ir suklastoto slapuko atmetimas.
- Abu formų siuntimai apsaugoti nuo greitų pakartojimų ir patikrinti automatiškai.
- Auth testų serveris 3107 prievade naudoja `tests/auth-mock.cjs` per Node preload. Jis perima visas Auth užklausas ir naudoja tik sintetinius vartotojus bei žetonus. Programa šio failo neimportuoja, įprastai paleistas serveris naudoja tikrą Supabase.
- Nauji tikri vartotojai, duomenų lentelės ir RLS taisyklės testuojant nekurti. `.env.local` nekeistas.

Oficialūs šaltiniai: [Supabase SSR klientai ir Proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [PKCE kodo keitimas į sesiją](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession).

## 8 užduotis: „Mano receptai“

Jau įvykdytos `001_saved_recipes.sql` migracijos nekartoti. Šiame etape lentelė, RLS ir duomenų bazės leidimai automatiškai nekeičiami.

- Recepto puslapyje prisijungęs vartotojas mato „❤️ Išsaugoti“, o jau išsaugotam receptui – „❤️ Išsaugota“.
- `POST /api/saved-recipes` priima `mealId`. Serveris patikrina vartotoją per `getUser()`, gauna originalą iš TheMealDB ir įrašo `meal_id`, `title`, `image_url`, patikrintą `user_id`.
- Naršyklės atsiųstais `user_id`, pavadinimu ir nuotrauka nepasitikima. Visos duomenų bazės užklausos vykdomos tuo pačiu Supabase klientu su esamos užklausos vartotojo slapukais.
- `GET /api/saved-recipes` grąžina tik savo sąrašą. Atsakyme nėra prisijungimo žetonų ar API raktų.
- `/my-recipes` rodo sąrašą, naujausi įrašai pirmi. Kortelės atidaro esamą recepto peržiūrą.
- `DELETE /api/saved-recipes/[id]` naudoja išsaugoto įrašo UUID, tikrina vartotoją ir filtruoja pagal jo ID. Svetimas ir neegzistuojantis įrašas grąžina tą patį 404 atsakymą.
- Neprisijungus asmeninis puslapis nukreipia į `/login`, o API grąžina 401. Vykstant užklausai pakartotiniai mygtuko paspaudimai blokuojami.
- Veikia įkėlimo, tuščio sąrašo, sėkmės ir klaidos būsenos. Nepavykęs pašalinimas nepaslepia kortelės. Pasiekus unikalumo apribojimą tikrinamas savo esamas įrašas ir dublikatas nekuriamas.
- Asmeniniai API atsakymai turi `Cache-Control: private, no-store`. Proxy apima ir `/my-recipes`.

### Patikrinimai po nutrūkusios sesijos

- `npm run build` ir `npm run typecheck` – praėjo.
- `npm run test:e2e` – 9 ankstesni testai praėjo.
- `npm run test:auth` – 12 testų praėjo: 6 ankstesni Auth ir 6 nauji išsaugojimo testai.
- Nauji testai patikrino išsaugojimą, dublikatus, perkrovimą, pašalinimą, vieną greitą siuntimą, atsijungusio vartotojo blokavimą, įvestį, netinkamą užklausos kilmę, serverio parenkamą savininką bei originalų recepto turinį, dviejų testinių vartotojų atskyrimą, 42501, tinklo klaidą ir pasibaigusią sesiją.
- Testinis serveris imituoja ir Auth, ir visas Data API užklausas. Tikra Supabase duomenų bazė testuojant nekeičiama. Tai patikrina aplikacijos sesijos perdavimą ir filtrus, bet nepakeičia tikrų RLS taisyklių patikros.
- Tikros vartotojo sesijos automatiniam bandymui nebuvo. Ankstesnis tikras anoniminis GET grąžino 401 / 42501, kaip ir numatyta migracijoje.

### Rankinis patikrinimas prisijungus

1. Atidaryti `http://localhost:3001/login` ir prisijungti savo naršyklėje. Slaptažodžio ar slapukų niekam siųsti nereikia.
2. Atidaryti `http://localhost:3001/api/saved-recipes`. Sėkmės atveju grąžinamas `recipes` sąrašas (tuščiam sąrašui – `[]`). Tai tik skaitymo patikra su dabartine sesija.
3. Atidaryti `http://localhost:3001/recipes/52940`, paspausti „❤️ Išsaugoti“. Turi pasirodyti „❤️ Išsaugota“.
4. Atidaryti `http://localhost:3001/my-recipes`. Turi būti „Brown Stew Chicken“ kortelė. Perkrauti puslapį – įrašas turi išlikti.
5. Grįžti į receptą ir patikrinti, kad jis jau išsaugotas. Tuomet „Mano receptai“ puslapyje jį pašalinti ir perkrauti puslapį.
6. Atsijungus bandyti atidaryti asmeninį sąrašą – turi būti siūlomas prisijungimas. Išsaugojimo API turi grąžinti 401.

### „API DISABLED“ ir tikros prieigos diagnostika

Vien valdymo skydelio žyma nepatvirtina leidimų būsenos. Projekte dar nepatvirtinta, ar prisijungęs vartotojas iš tiesų gauna klaidą. Anoniminis 401 / 42501 yra laukiamas ir nėra priežastis suteikti `anon` prieigą.

Jei prisijungus API grąžina klaidą, analizei pakanka `code` ir `error` laukų – nesiųsti Cookie, Authorization, slaptažodžių ar tinklo užklausų kopijų su antraštėmis.

- `AUTH_REQUIRED` (401): nėra galiojančios vartotojo sesijos. Prisijungti tuo pačiu `localhost:3001` adresu.
- `SCHEMA_ACCESS_DENIED` (403): serveris gavo 42501 su `permission denied for schema`; tikrinti `authenticated` USAGE teisę `public` schemai.
- `RECIPES_ACCESS_DENIED` (403): tikrinti konkrečios operacijos `authenticated` teisę ir RLS taisyklę. Šis kodas nereiškia, kad reikia įjungti anoniminę prieigą.
- `RECIPES_NOT_EXPOSED` (503): tikrinti, ar Data API eksponuoja `public` schemą ir ar lentelė pasiekiama schemos podėlyje.

Jei reikia nustatyti tikras teises, SQL Editor galima pačiam vykdyti šią **tik skaitymo** užklausą. Ji nekeičia lentelės ar leidimų:

```sql
select
  has_schema_privilege('authenticated', 'public', 'USAGE') as schema_usage,
  has_table_privilege('authenticated', 'public.saved_recipes', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.saved_recipes', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.saved_recipes', 'DELETE') as can_delete,
  has_table_privilege('authenticated', 'public.saved_recipes', 'UPDATE') as can_update,
  has_table_privilege('anon', 'public.saved_recipes', 'SELECT') as anon_can_select,
  c.relrowsecurity as rls_enabled
from pg_class c
where c.oid = 'public.saved_recipes'::regclass;
```

Laukiama: `schema_usage`, `can_select`, `can_insert`, `can_delete`, `rls_enabled` – true; `can_update`, `anon_can_select` – false. Konkretaus leidimų pataisymo dabar nesiūlome vykdyti: pirmiausia reikia tikros klaidos arba šios diagnostikos rezultato, tada atskiro vartotojo patvirtinimo.


## 13 užduotis – ankstesnė diagnostika

Ankstesniuose bandymuose Gemini grąžino HTTP 503 UNAVAILABLE. Prieš 15 užduotį vartotojas patvirtino, kad klaida buvo laikina ir aplikacijoje matė sugeneruotą AI atsakymą. Tai vartotojo patvirtinimas; 18 užduoties metu tikro generavimo nekartojome. Modelis nekeistas.

## 14 užduotis – pasirinkimai ir tikslaus prompt peržiūra

- Recepto puslapyje pasirinkti laiką 15/30/60 min., žmonių skaičių 1/2/4 ir tikslą: paprasčiau, pigiau, sveikiau arba kuo panašiau į originalą. Numatyta: 30 min., 2 žmonės, kuo panašiau į originalą.
- POST /api/ai gauna recipeId, situation ir options: minutes, people, goal (simpler/cheaper/healthier/original). Serveris tikrina reikšmes ir gauna originalą iš TheMealDB. Senas 13 užduoties formatas be options naudoja numatytuosius pasirinkimus; 12 užduoties prompt formatas išliko.
- „Peržiūrėti galutinį prompt“ siunčia preview: true. Serveris grąžina prompt ir previewHash, nekviečia Gemini; peržiūra veikia ir be Gemini rakto. Naudojamos tos pačios įvesties, Origin, dydžio ir bendro Redis dažnio apsaugos (peržiūra taip pat skaičiuojama į limitą).
- Peržiūra ir generavimas naudoja tą pačią prompt funkciją. Po peržiūros generavimo užklausa siunčia previewHash: jei serverio sudarytas tekstas pasikeitė, HTTP 409 PROMPT_CHANGED sustabdo generavimą. Pakeitus formos įvestį sena peržiūra pašalinama.
- Prompt pateikiamas kaip paprastas tekstas. API raktas į jį nededamas. Originalus receptas nepakeičiamas, AI išsaugojimas nekuriamas.

Rankinė patikra be generavimo: atidaryti http://localhost:3001/recipes/52940, įrašyti situaciją, pasirinkti reikšmes ir spausti tik „Peržiūrėti galutinį prompt“. Patikrinti originalų pavadinimą, ingredientus, kiekius, instrukcijas, situaciją ir visas tris pasirinkimų reikšmes. Pakeitus pasirinkimą peržiūra dingsta; ją galima atnaujinti. Nespausti „✨ Pritaikyti receptą“, jei nenorima tikros generavimo užklausos.

Automatinės patikros: npm run test:ai (Gemini ir recepto gavimas imituoti), npm run test:e2e (AI atsakymai imituoti), npm run typecheck, npm run build.


## 17 užduotis – Developer Mode

Globalus jungiklis yra po navigacija. Jis pagal nutylėjimą išjungtas; būsena ir daugiausia 30 paskutinių užklausų laikomi tik skirtuko atmintyje. Vidinė Next.js navigacija būseną išlaiko, visas puslapio perkrovimas ją išjungia. Išjungus režimą istorija išvaloma. „Išvalyti“ pašalina įrašus nekeičiant jungiklio. Iki išvalymo ar išjungimo pradėtų užklausų vėluojantys atsakymai istorijos nebeatkuria.

„Naršyklės API užklausos“ rodo operaciją, fiksuotą endpoint šabloną, HTTP metodą, mūsų aplikacijos atsakymo HTTP statusą, HTTP sėkmę ir laiką iki fetch atsakymo antraščių (ms). JSON apdorojimas į trukmę neįtraukiamas. Tinklo klaida ir atšaukimas rodomi be išgalvoto HTTP statuso.

Klientiniai paieškos, AI pritaikymo, prompt peržiūros, išsaugojimo ir pašalinimo kvietimai naudoja bendrą diagnosticFetch. Nepakeičiamas globalus window.fetch, nekeičiami request argumentai, signalas, timeout, retry ar response. Išjungus režimą įrašai nerenkami. Diagnostikos duomenys niekur nesiunčiami ir nepersistuoja.

Saugumas: saugomos tik fiksuotos operacijų ir endpoint žymos bei statusai ir trukmės. Query, įrašų ID (vietoje jų [id]), antraštės, slapukai, raktai, slaptažodžiai, pasirašyti rezultatai, prompt, AI tekstas ir pilni klaidų objektai nerenkami. Prompt peržiūra turi atskirą žymą ir nėra vadinama Gemini generavimu.

Ribos: tai naršyklės aplikacijos API diagnostika. Tiesioginės serverio komponentų TheMealDB užklausos, Supabase SDK vidiniai kvietimai, Server Actions ir sesijos atnaujinimas lentelėje nerodomi. Endpoint 502 nėra pristatomas kaip Gemini HTTP statusas. Prisijungimo / atsijungimo pilnas puslapio perkrovimas išjungia režimą.

Rankinis testas be Gemini generavimo: atidaryti http://localhost:3001, įjungti Developer Mode ir ieškoti chicken. Lentelėje turi atsirasti GET /api/recipes, HTTP 200, sėkmė ir trukmė. Atidarius receptą galima naudoti „Peržiūrėti galutinį prompt“: lentelė rodo POST /api/ai ir peržiūros operaciją, bet nerodo paties teksto. Patikrinti „Išvalyti“, išjungimą ir puslapio perkrovimą. Mygtukas „Pritaikyti receptą“ tebesiunčia tikrą generavimo užklausą – šio etapo patikrai jo nereikia.

17 užduoties testai: npm run test:developer – 11; npm run test:e2e – 19; npm run test:auth – 17, visi sėkmingi. TypeScript ir build sėkmingi. Gemini ir Supabase veiksmų regresiniuose testuose naudoti imituoti atsakymai; naujų tikrų Gemini generavimo užklausų nesiųsta.

## 18 užduotis – PRE-DEPLOY paruošimas (deploy neatliktas)

### APP_URL

`src/lib/app-url.ts` turi `server-only`. `APP_URL` neturi NEXT_PUBLIC priešdėlio. Development aplinkoje nenurodžius arba palikus tuščią reikšmę naudojama `http://localhost:3001`; galima aiškiai nurodyti kitą vietinį HTTP adresą arba HTTPS origin. Production aplinkoje trūkstama, tuščia, HTTP, localhost, su prisijungimo duomenimis, keliu, query ar fragmentu reikšmė atmetama. Registracija nesukuria paskyros su klaidingu grįžimo adresu; patvirtinimo maršrutas netinkamai sukonfigūruotas grąžina saugų 503 ir nekeičia sesijos. Build neskaito šio adreso iš anksto: validacija vyksta autentifikacijos užklausoje.

`/auth/confirm` konstruojamas tik iš patikrintos konfigūracijos. Host, forwarded antraštės ir `next` parametras negali pasirinkti nukreipimo. Production HTTPS adresas naudojamas ir sėkmingam, ir nesėkmingam grįžimui. Supabase dashboard dar nekeistas.

### Redis ribotuvas

Naudojami `@upstash/redis` ir `@upstash/ratelimit`, tik serveryje. Viena Redis duomenų bazė saugo visų Vercel instancijų dažnio skaitiklius ir vienalaikių užklausų užraktus. SDK klientai gali būti laikomi proceso atmintyje, tačiau skaitikliai ir užraktai – Redis. Prefix stabilus tarp deploy; development, preview ir production atskirti.

Išlaikytos 5 užklausų/min. vienam įrašui ir 20/min. visai aplikacijai ribos, 1 ir 2 vienalaikių užklausų ribos. Endpoint sąmoningai tebenaudoja vieną bendrą `shared` įrašą visiems lankytojams: reali šios minimalios versijos riba yra **5 užklausos/min. ir viena vykstanti užklausa visiems kartu**, o ne vienam IP. Tai išlaiko ankstesnę konservatyvią elgseną, bet dabar ribos bendros visoms instancijoms. Nepasitikima kliento IP antraštėmis. Atskiras patikimas IP adapteris šiame etape nepridedamas.

Dažnis tikrinamas Redis fixed-window algoritmu; ties minutės riba leidžiami dviejų gretimų langų siuntimai, tai nėra slenkantis 60 sekundžių limitas. Vienalaikių užklausų leidimai įgyvendinti atominiu Lua scenarijumi. Užraktas turi atsitiktinį savininko ID, Redis serverio laiką ir 90 s galiojimą. Senas darbuotojas negali pašalinti naujo leidimo. Procesui nutrūkus užraktas pasibaigia savaime. Release atliekamas finally; jei Redis tuo metu sutrinka, sugeneruotas rezultatas neišmetamas, užraktas pasibaigs pagal TTL.

Kiekvieno Redis HTTP kvietimo laukimas ribojamas iki 1 s, automatiniai retry išjungti. SDK timeout fail-open rezultatas aiškiai atmetamas. Trūkstant nustatymų arba sutrikus Redis: HTTP 503 `AI_LIMITER_UNAVAILABLE`, jokių TheMealDB ar Gemini kvietimų. Viršijus ribą: 429 `AI_RATE_LIMITED` ir Retry-After. Neįjungtas vietinis atsarginis ribotuvas, analytics ir ephemeral cache išjungti. Raw SDK klaidos, credentials ir vartotojo turinys nežurnaluojami.

Prompt peržiūra taip pat naudoja šį ribotuvą; kol neįrašyti Redis nustatymai, ji ir generavimas grąžins 503. `.env.local` šiame etape nepakeistas. Informacija apie SDK timeout elgseną: https://upstash.com/docs/redis/sdks/ratelimit-ts/features.

### Vykdymas ir būsimi rankiniai veiksmai

- `package.json` nustato Node.js 24.x. `POST /api/ai` lieka Node.js maršrutas.
- `maxDuration = 60` yra sąmoningas aplikacijos vykdymo biudžetas (Redis patikros, iki 10 s kūno skaitymas, 15 s recepto gavimas, 30 s Gemini laukimas), ne tariamas Vercel reikalavimas. Gemini 30 s riba ir modelis nekeisti. 90 s užraktas ilgesnis už funkcijos vykdymo ribą.
- Vėliau vartotojui reikės sukurti Upstash Redis ir saugiai įrašyti `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Naudoti įprastą REST token su Redis rašymo teise, ne read-only token. Tikro Redis šiame etape nekūrėme.
- Vercel Production reikės visų septynių kintamųjų: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `AI_RECIPE_SIGNING_SECRET`, `APP_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Pasirašymo paslaptis turi išlikti stabili tarp deploy. Preview konfigūruoti atskirai; neviešinti neapsaugotų bandomųjų diegimų su production paslaptimis.
- Supabase Site URL ir tikslų `/auth/confirm` Redirect URL suderinti su production APP_URL tik gavus leidimą. RLS, lentelės ir migracijos nekeičiamos.
- Tik tada atlikti deploy. Tikras Redis veikimas Vercel aplinkoje dar nepatikrintas; patikrai nereikia generuoti Gemini teksto – galima naudoti prompt peržiūrą, gavus leidimą.

### Patikros

`typecheck` ir `build` sėkmingi. `test:ai` 62, `test:rate-limit` 9, `test:app-url` 13, `test:auth` 17, `test:e2e` 19, `test:developer` 11, `test:themealdb` 6, `test:rls` 9 – visi sėkmingi. Rate-limit testai imituoja bendrą Redis ir jo klaidas; tai nėra gyvas Upstash ar Lua vykdymo testas. Auth naršyklės testai naudoja tikrų SDK transportą su imituotais Redis/Supabase/Gemini HTTP atsakymais. E2E TheMealDB paieška tikra, Gemini imituotas. Tikrų Gemini generavimo užklausų nesiųsta.

### 18 užduotis – izoliuotas tikras Redis limiterio testas (2026-10-01)

`npm run test:rate-limit:live` yra aiškiai pasirenkamas tikro Upstash testas, ne įprastos automatinių testų komandos dalis. Jis skaito `.env.local` nekeisdamas failo. `createAiLimiter(testPrefix?)` priima tik vidinį `fridge-rescue:TEST-ONLY:` prefiksą; be argumento production konfigūracija nesikeičia. Prefikso negalima perduoti per HTTP.

Testas tiesiogiai kviečia tikrą `/api/ai` POST funkciją su Request objektais, naudoja tikrą ribotuvą, Upstash SDK ir Redis Lua. Tai nėra per HTTP serverį ar Vercel atliktas testas. Tik Gemini modulis ir testui parenkamas ribotuvo singleton pakeičiami imitacija / izoliuotu egzemplioriumi. Išorinės tinklo užklausos leidžiamos tik į sukonfigūruotą Redis origin; tikras Gemini nekviečiamas. Kiekvienas scenarijus turi unikalų UUID prefiksą. 5/min scenarijus vykdomas tame pačiame tikrame fixed-window minutės intervale.

Rezultatas: pirmi 5 bandymai HTTP 200, šeštas HTTP 429 `AI_RATE_LIMITED` su Retry-After. Laikant pirmą užklausą aktyvią, kita grąžino 429; užbaigus pirmąją gautas 200, po release nauja užklausa vėl gavo 200. Gemini tinklo kvietimų 0. Tik šio testo prefiksų 4 likę Redis raktai pašalinti, pakartotinė SCAN patikra rado 0; TTL patikrintas (skaitikliai iki 60 s, užraktai iki 90 s). Normalūs limiterio raktai neliesti. Pradinis bandymas ribotoje tinklo aplinkoje negalėjo užbaigti patikros; aukščiau pateikti rezultatai gauti leidus tinklo prieigą.

Po minimalaus pakeitimo: test:rate-limit 10/10, test:ai 62/62, typecheck sėkmingi. Tikras Redis patikrintas lokaliai, Vercel deploy neatliktas.
