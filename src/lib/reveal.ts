/**
 * Fait entrer les sections de la page à mesure qu'on les atteint : chacune reçoit `data-in`, et
 * globals.css fait le reste. Un attribut plutôt qu'une classe : React réécrit `className`, pas
 * ce qu'il n'a pas posé, donc un rafraîchissement du direct ne rejoue rien.
 *
 * Tant qu'une section n'a pas `data-in`, elle est invisible : ne jamais noter à part « celle-ci
 * est déjà surveillée ». Une telle marque survit à l'observateur qui l'a posée, et la section
 * reste cachée pour de bon. Observer deux fois le même élément ne fait rien, on peut donc
 * simplement tout redemander.
 */
export function watchSections(root: Document = document): () => void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute("data-in", "");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  const scan = () => {
    for (const el of root.querySelectorAll("main section:not([data-in])")) io.observe(el);
  };
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(root.body, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    io.disconnect();
  };
}
