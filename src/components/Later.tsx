import { Suspense } from "react";

/** Rend la main une fois : tout ce qui est déjà prêt part vers le navigateur avant ce contenu. */
async function Deferred({ children }: { children: React.ReactNode }) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return <>{children}</>;
}

/**
 * Un contenu envoyé juste après le reste de la page, dans la même réponse : l'onglet ouvert
 * s'affiche d'abord, les autres arrivent derrière sans nouvelle requête au serveur. Un onglet
 * qu'on ouvrirait avant leur arrivée montre une attente brève.
 */
export function Later({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="tab-wait" aria-busy="true" aria-label="Chargement">
          <i />
          <i />
          <i />
        </div>
      }
    >
      <Deferred>{children}</Deferred>
    </Suspense>
  );
}
