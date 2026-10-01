**🟢 LENGVOS UŽDUOTYS**

1. Pirmiausia išsiaiškinkite, ką grąžina API. Atidaryti TheMealDB `filter.php?i=chicken`, surasti receptų sąrašą, pavadinimą, ID ir nuotrauką. Suprasti API, endpoint, parametrą, request, response ir JSON. Šią mokymosi užduotį jau atlikome.
2. Susiplanuokite „Fridge Rescue“. Naudoti Plan režimą. Plane paaiškinti pagrindines dalis, TheMealDB, Supabase, Gemini, naršyklės ir serverio atsakomybes. Tik po plano patvirtinimo kurti projektą.
3. Sukurkite pirmą receptų paiešką. Ingrediento laukelis, mygtukas „Ieškoti“, rezultatai su pavadinimu, nuotrauka ir ID. Išbandyti tris ingredientus. Duomenys turi ateiti iš API.
4. Atidarykite konkretų receptą. Pagal ID gauti pavadinimą, nuotrauką, kategoriją, regioną, ingredientus ir instrukciją.

**🟡 VIDUTINĖS UŽDUOTYS**

5. Pridėkite antrą paieškos būdą ir klaidų valdymą. Paieška pagal ingredientą arba patiekalo pavadinimą. Sutvarkyti tuščią laukelį, nerastus rezultatus, įkėlimą, API klaidas ir greitus pakartotinius paspaudimus.
6. Sukurkite Supabase projektą. Gauti Project URL ir Publishable key. Prijungti prie Next.js. Naudoti `.env.local`.
7. Sukurkite registraciją ir prisijungimą. Registruotis, prisijungti, atsijungti, el. pašto patvirtinimas, klaidų pranešimai ir sesijos išsaugojimas.
8. Pridėkite „Mano išsaugoti receptai“. Išsaugoti receptą Supabase, susieti su vartotojo ID, rodyti tik savo receptus ir leisti pašalinti.
9. Patikrinkite, ar vartotojai tikrai atskirti. Sukurti RLS taisykles. Patikrinti dvi paskyras A ir B, kad negalėtų matyti ar keisti viena kitos duomenų.
10. Susikurkite Gemini API prieigą. Gauti API raktą Google AI Studio. Saugoti jį `.env.local` kaip `GEMINI_API_KEY`, neviešinti GitHub ar naršyklėje.
11. Pirmiausia patikrinkite Gemini atskirai. Įdiegti oficialų SDK, sukurti bandomąją serverio užklausą naudojant `gemini-3.8-flash`. Patikrinti atsakymą.

**🔴 SUNKIOS UŽDUOTYS**

12. Sukurkite savo AI endpoint. Naudoti Plan režimą. Sukurti `/api/ai` arba analogišką serverio maršrutą. Gemini raktas turi likti serveryje.
13. Sukurkite „AI recepto gelbėtoją“. Vartotojas įrašo savo situaciją. Gemini gauna originalų receptą, ingredientus, instrukciją ir vartotojo prašymą. Parodo pritaikytą receptą.
14. Padarykite AI užklausą protingesnę. Pridėti laiko pasirinkimą 15/30/60 min., žmonių skaičių 1/2/4 ir tikslą: paprasčiau, pigiau, sveikiau arba panašiau į originalą. Galėti peržiūrėti galutinį prompt.
15. Leiskite išsisaugoti AI sukurtą receptą. Tik prisijungusiam vartotojui. Supabase saugoti originalų pavadinimą, vartotojo prašymą, AI atsakymą, datą ir vartotojo ID. Sukurti „Mano AI receptai“.
16. Sutvarkykite API klaidas. Išbandyti neteisingą Gemini raktą, 429 limitą, neteisingą receptų API endpoint, atsijungusio vartotojo operacijas ir bandymus pasiekti svetimus duomenis.
17. Pridėkite „Developer Mode“. Jungiklis, rodantis API sistemą, endpoint, HTTP metodą, statusą, sėkmę ir užklausos trukmę. Nerodyti slaptų raktų ar slaptažodžių.
18. Paleiskite visą sistemą Vercel. Nustatyti Environment Variables, atlikti Deploy ir sutvarkyti Supabase autentifikacijos URL.
19. Galutinis testas. Viešoje Vercel aplikacijoje vartotojas A registruojasi, prisijungia, ieško, išsaugo, pritaiko ir išsaugo AI receptą. Vartotojas B Incognito lange patikrina, kad nemato A duomenų.

**⭐ PAPILDOMA UŽDUOTIS**

„Mano virtuvė“: vartotojas išsaugo turimus produktus Supabase. Gemini palygina recepto ingredientus su turimais produktais, nurodo, ko trūksta ir kuo galima pakeisti. Vartotojų duomenis apsaugoti RLS.
