import Link from "next/link";

/** Une page qui n'existe pas : un écran de fin de partie, plutôt qu'une erreur sèche. */
export default function NotFound() {
  return (
    <section className="lost">
      <div className="lost-code display" aria-hidden>
        <span>4</span>
        <span>0</span>
        <span>4</span>
      </div>
      <h1 className="display text-3xl sm:text-5xl">Page éliminée</h1>
      <p className="mt-3 text-sm text-dim">Ce lien ne mène à rien : le match ou la compétition n&apos;est peut-être plus suivi.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-ink px-4 py-2 text-sm font-semibold text-bg transition-transform hover:scale-105">
        Retour à l&apos;accueil
      </Link>
    </section>
  );
}
