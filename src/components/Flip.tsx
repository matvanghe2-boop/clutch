"use client";

const quiet = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** La carte pivote d'un quart de tour, change de face au moment où on la voit par la tranche, et revient. */
function flip(card: Element | null) {
  if (!(card instanceof HTMLElement)) return;
  const swap = () => card.toggleAttribute("data-flipped");
  if (quiet()) return swap();
  card
    .animate([{ transform: "perspective(900px) rotateY(0deg)" }, { transform: "perspective(900px) rotateY(90deg)" }], { duration: 150, easing: "ease-in" })
    .finished.then(() => {
      swap();
      card.animate([{ transform: "perspective(900px) rotateY(-90deg)" }, { transform: "perspective(900px) rotateY(0deg)" }], { duration: 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    })
    .catch(swap);
}

/** Le bouton qui retourne une carte de match. */
export function FlipToggle() {
  return (
    <button type="button" className="flip-toggle" aria-label="Retourner la carte : face-à-face et forme" title="Face-à-face et forme" onClick={(e) => flip(e.currentTarget.closest(".flip-card"))}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" strokeLinecap="round" />
        <path d="M18 3v4h-4M6 21v-4h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Le dos de la carte : un clic n'importe où la remet à l'endroit. */
export function FlipBack({ children }: { children: React.ReactNode }) {
  return (
    <div className="flip-back" role="button" tabIndex={0} aria-label="Remettre la carte à l'endroit" onClick={(e) => flip(e.currentTarget.closest(".flip-card"))} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && flip(e.currentTarget.closest(".flip-card"))}>
      {children}
    </div>
  );
}
