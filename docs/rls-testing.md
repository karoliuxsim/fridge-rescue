# 9 užduotis: tikros RLS patikros instrukcija

## Kas patikrinta

Peržiūrėti `001_saved_recipes.sql`, serverio Supabase klientas, išsaugojimo API ir ankstesni testai.

- Migracijoje įjungtas RLS; SELECT ir DELETE naudoja `auth.uid() = user_id`, INSERT – tą pačią sąlygą su `WITH CHECK`.
- `authenticated` suteiktos tik SELECT, INSERT ir DELETE teisės. UPDATE nesuteiktas, `anon` teisės atšauktos.
- Aplikacijos API tikrina vartotoją per `getUser()` ir papildomai filtruoja pagal vartotojo ID.
- Ankstesni aplikacijos testai naudoja imituotą Supabase. Jie nėra gyvų duomenų bazės taisyklių įrodymas.

## Rezultatai 2026-09-22

| Testas | Imituotas įrankio testas | Tikra Supabase patikra |
| --- | --- | --- |
| B skaito A bandomąjį įrašą pagal UUID | PASS | Dar neatlikta – reikia dviejų sesijų |
| B trina A bandomąjį įrašą pagal UUID | PASS | Dar neatlikta – reikia dviejų sesijų |
| B įterpia įrašą su A user_id | PASS | Dar neatlikta – reikia dviejų sesijų |
| Anoniminis vartotojas skaito lentelę | PASS | PASS: SELECT su limit=0 atmestas, kodas 42501 |
| A bandomasis įrašas išlieka nepakitęs | PASS | Dar neatlikta – reikia dviejų sesijų |

Vartotojo jau atliktas A/B bandymas Safari Private lange patvirtina sąsajos atskyrimą. Jo nelaikome tiesioginiu B DELETE ar INSERT per Supabase bandymu.

## Paleidimas su dviem tikromis sesijomis

1. Palik veikti įprastą aplikaciją `http://localhost:3001`. Jei ji neveikia: `npm run build`, tada `npm start -- --hostname 127.0.0.1 --port 3001`.
2. Kitame terminalo lange, projekto aplanke, paleisk `npm run test:rls:live`.
3. Įrankis atidarys naują Chromium langą. Jame prisijunk kaip A, palauk prisijungimo būsenos. Terminale spausk tik Enter – el. pašto ar slaptažodžio į terminalą nerašyk.
4. Atsidarys atskiras izoliuotas langas B. Jame prisijunk kita paskyra, palauk prisijungimo būsenos ir terminale spausk Enter.
5. Įrankis patikrins abi sesijas per tikrą Supabase `getUser()`. Jei paskyros tos pačios arba prisijungti nepavyko, duomenų testai neprasidės.
6. Terminale įrašyk `TAIP`, kad pradėtų darbą su laikinais bandomaisiais įrašais.
7. Palauk visų rezultatų ir valymo pranešimo. Pasidalinti galima tik PASS / FAIL / INCONCLUSIVE eilutėmis. Slaptažodžių, žetonų, Cookie ar Authorization reikšmių nereikia.

Jei Chromium dar neįdiegtas, vieną kartą paleisk `npx playwright install chromium`.

## Ką įrankis daro

- Naudoja esamą `.env.local` tik skaitymui, tik Publishable key. Nepriima service_role ar Secret key.
- Prisijungimas vyksta įprastose aplikacijos formose. Įrankis nespausdina, nefilmuoja ir neįrašo prisijungimo duomenų ar sesijų į failus; sesijos laikomos tik atmintyje.
- Sukuria atskirus A ir B bandomuosius įrašus su naujais UUID ir pavadinimu `Fridge Rescue RLS TEST ...`.
- Pirmiausia patikrina, kad abi paskyros gali įterpti ir skaityti savo duomenis, o B gali trinti savo bandomąjį įrašą. Jei šios kontrolės neveikia, rezultatas INCONCLUSIVE, ne tariamas RLS PASS.
- B užklausos siunčiamos **tiesiai į Supabase**, ne į `/api/saved-recipes`. Svetimo įrašo SELECT ir DELETE turi tik UUID filtrą, be aplikacijos savininko filtro.
- Saugios SELECT ir DELETE RLS taisyklės paprastai grąžina sėkmingą atsakymą su tuščiu sąrašu. Vien HTTP 200 nereiškia, kad svetimas įrašas buvo pasiekiamas ar pašalintas.
- Svetimo savininko INSERT turi būti atmestas su 42501. Papildomai A sesija tikrinama, kad toks įrašas tikrai neatsirado.
- Penktas testas tikrina, kad A bandomasis įrašas nepakito. **Tik po šio patikrinimo** įrankis pašalina savo sukurtus bandomuosius duomenis, naudodamas jų UUID, savininką ir unikalų žymeklį.
- Baigęs atsijungia nuo naujų testinių sesijų ir uždaro testinius langus. Esamos Safari sesijos nenaudojamos.

**Jau išsaugotas A receptas neliečiamas.** Jo UUID net neperduodamas įrankiui. Jei DELETE RLS būtų sugadintas, B galėtų pašalinti tik šio paleidimo naują bandomąjį įrašą – tada testai 2 ir 5 rodytų FAIL.

Jei įrankis priverstinai nutraukiamas arba duomenų valymas nepavyksta, gali likti naujų `Fridge Rescue RLS TEST ...` įrašų. Ataskaita neprilygsta sėkmingam valymui, kol jo būsena nėra PASS. Esamų receptų dėl to netrink.

## Rezultatų reikšmės

- **PASS** – konkreti patikra įvykdyta ir gautas laukiamas rezultatas.
- **FAIL** – pastebėtas saugumo ar numatytos leidimų konfigūracijos neatitikimas. Leidimų automatiškai netaisyti; pirmiausia išnagrinėti rezultatą.
- **INCONCLUSIVE** – testui trūko prieigos, nepavyko kontrolinė operacija ar ryšys. Tai nėra RLS veikimo patvirtinimas.

Anoniminė patikra patvirtina duomenų bazės **leidimų** draudimą. Ji viena neįrodo visų autentifikuotų vartotojų RLS taisyklių.

## Automatinių testų komandos

- `npm run test:rls` – 9 **imituoti** patikros įrankio testai. Tikrina ir specialiai sugadintą SELECT, DELETE, INSERT, anoniminės prieigos konfigūraciją, klaidingų PASS vengimą bei esamo recepto neliečiamumą.
- `npm run test:rls:live -- --anon-only` – tikras, tik skaitymo anoniminės prieigos testas; nekuria bandomųjų įrašų ir neprašo prisijungti.
- `npm run test:rls:live` – tikras penkių patikrų rinkinys su dviem tavo įprastai naršyklėje sukurtomis sesijomis.

Jokių migracijų, RLS pakeitimų, leidimų keitimo ar administratoriaus rakto šie testai nevykdo.
