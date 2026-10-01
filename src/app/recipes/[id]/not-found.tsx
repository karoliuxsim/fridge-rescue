import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <main className="shell recipe-page">
      <Link className="back-link" href="/">← Grįžti į paiešką</Link>
      <section className="notice">
        <h1 className="state-title">Receptas nerastas</h1>
        <p>Recepto su šiuo ID nėra. Grįžk į paiešką ir pasirink kitą receptą.</p>
      </section>
    </main>
  );
}
