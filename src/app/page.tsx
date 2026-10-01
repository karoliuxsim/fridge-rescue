import SearchForm from "@/components/SearchForm";

export default function Home() {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">MAŽIAU ŠVAISTYMO. DAUGIAU SKONIO.</p>
        <h1>Geras patiekalas prasideda<br className="desktop-break" /> nuo to, ką jau turi.</h1>
        <p className="description">Ieškok pagal ingredientą arba patiekalo pavadinimą ir atrask naujų idėjų savo virtuvei.</p>
      </section>
      <SearchForm />
      <footer>Receptų šaltinis: <a href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a></footer>
    </main>
  );
}
