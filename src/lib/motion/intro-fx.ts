/**
 * Ce qui change d'un jeu à l'autre dans l'intro d'un match. La mise en place et le choc gardent la
 * même structure (intro.ts) ; chaque jeu y met sa signature, avec des motifs à nous :
 *   Rocket League   des traînées de boost, puis une explosion en rayons ;
 *   Counter-Strike  un radar et un signal qui s'accélère, puis un flash aveuglant ;
 *   Call of Duty    un viseur qui se verrouille, puis une marque d'impact et un écran qui saute.
 */

export interface IntroFx {
  /** La force du flash : son pic d'opacité et sa durée. */
  flash: { peak: number; ms: number };
  /** Le nombre d'éclats, en proportion du nombre habituel. */
  sparks: number;
  /** Le moment du choc. */
  impact(x: number, y: number): void;
}

const OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

function el(className: string, parent: HTMLElement, text?: string) {
  const node = document.createElement("div");
  node.className = className;
  if (text) node.textContent = text;
  parent.append(node);
  return node;
}

const gone = (node: HTMLElement) => () => node.remove();

function boost(stage: HTMLElement, W: number): IntroFx {
  // Des traînées qui filent de chaque côté vers le centre, en boucle tant que la scène attend.
  const count = W < 640 ? 9 : 16;
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const t = el(`ifx-trail ${left ? "ifx-trail-a" : "ifx-trail-b"}`, stage);
    const length = 18 + Math.random() * 30;
    t.style.top = `${4 + Math.random() * 92}%`;
    t.style.width = `${length}vw`;
    t.style.height = `${1 + Math.random() * 3}px`;
    t.style[left ? "left" : "right"] = `${-length}vw`;
    const sign = left ? 1 : -1;
    t.animate([{ transform: "translateX(0)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translateX(${sign * (length + 44)}vw)`, opacity: 0 }], {
      duration: 420 + Math.random() * 500,
      delay: Math.random() * 500,
      iterations: Infinity,
      easing: "cubic-bezier(0.4, 0, 0.9, 0.7)",
    });
  }
  return {
    flash: { peak: 0.8, ms: 260 },
    sparks: 1.4,
    impact(x, y) {
      stage.querySelectorAll<HTMLElement>(".ifx-trail").forEach((t) => t.remove());
      const burst = el("ifx-burst", stage);
      burst.style.left = `${x}px`;
      burst.style.top = `${y}px`;
      burst
        .animate(
          [
            { transform: "translate(-50%, -50%) scale(0.15) rotate(0deg)", opacity: 1 },
            { transform: "translate(-50%, -50%) scale(1) rotate(24deg)", opacity: 0 },
          ],
          { duration: 720, easing: OUT, fill: "forwards" },
        )
        .finished.then(gone(burst), gone(burst));
    },
  };
}

function radar(stage: HTMLElement): IntroFx {
  const dial = el("ifx-radar", stage);
  const sweep = el("ifx-sweep", dial);
  sweep.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 1100, iterations: Infinity, easing: "linear" });
  dial.animate([{ opacity: 0, scale: "0.7" }, { opacity: 1, scale: "1" }], { duration: 380, easing: OUT, fill: "both" });
  // Le signal rouge bat de plus en plus vite : on sait que ça va partir.
  const dot = el("ifx-signal", dial);
  const beat = dot.animate([{ opacity: 1, scale: "1" }, { opacity: 0.2, scale: "0.7" }], { duration: 260, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
  const speedUp = window.setInterval(() => beat.updatePlaybackRate(Math.min(5, beat.playbackRate * 1.28)), 160);
  return {
    flash: { peak: 1, ms: 560 },
    sparks: 0.5,
    impact(x, y) {
      clearInterval(speedUp);
      dial.remove();
      for (let i = 0; i < 2; i++) {
        const ping = el("ifx-ping", stage);
        ping.style.left = `${x}px`;
        ping.style.top = `${y}px`;
        ping
          .animate(
            [
              { transform: "translate(-50%, -50%) scale(0.1) rotate(45deg)", opacity: 1 },
              { transform: "translate(-50%, -50%) scale(1) rotate(45deg)", opacity: 0 },
            ],
            { duration: 620, delay: i * 110, easing: OUT, fill: "both" },
          )
          .finished.then(gone(ping), gone(ping));
      }
    },
  };
}

function reticle(stage: HTMLElement, cy: number): IntroFx {
  const scan = el("ifx-scan", stage);
  scan.animate([{ backgroundPosition: "0 0" }, { backgroundPosition: "0 120px" }], { duration: 900, iterations: Infinity, easing: "linear" });
  const aim = el("ifx-aim", stage);
  aim.style.top = `${cy}px`;
  aim.animate(
    [
      { transform: "translate(-50%, -50%) scale(3.2) rotate(45deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
    ],
    { duration: 520, easing: OUT, fill: "both" },
  );
  for (const corner of ["tl", "tr", "bl", "br"]) el(`ifx-corner ifx-${corner}`, aim);
  const hud = el("ifx-hud display", stage, "Verrouillage");
  hud.style.top = `${cy}px`;
  hud.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 130, iterations: Infinity, direction: "alternate" });
  return {
    flash: { peak: 0.5, ms: 200 },
    sparks: 0.7,
    impact(x, y) {
      aim.remove();
      hud.remove();
      scan.remove();
      // La marque d'impact : quatre traits qui s'écartent du centre.
      for (const deg of [45, 135, 225, 315]) {
        const mark = el("ifx-hit", stage);
        mark.style.left = `${x}px`;
        mark.style.top = `${y}px`;
        mark
          .animate(
            [
              { transform: `rotate(${deg}deg) translateX(14px) scaleX(0.4)`, opacity: 1 },
              { transform: `rotate(${deg}deg) translateX(44px) scaleX(1)`, opacity: 1, offset: 0.35 },
              { transform: `rotate(${deg}deg) translateX(70px) scaleX(0.6)`, opacity: 0 },
            ],
            { duration: 420, easing: "ease-out", fill: "forwards" },
          )
          .finished.then(gone(mark), gone(mark));
      }
      // L'écran saute : des bandes décalées, le temps d'un clignement.
      for (let i = 0; i < 7; i++) {
        const slice = el("ifx-slice", stage);
        slice.style.top = `${Math.random() * 96}%`;
        slice.style.height = `${3 + Math.random() * 16}px`;
        const shift = (Math.random() - 0.5) * 90;
        slice
          .animate(
            [
              { transform: `translateX(${shift}px)`, opacity: 0.55 },
              { transform: `translateX(${-shift}px)`, opacity: 0 },
            ],
            { duration: 200 + Math.random() * 120, delay: Math.random() * 60, easing: "steps(4)", fill: "both" },
          )
          .finished.then(gone(slice), gone(slice));
      }
    },
  };
}

export function introFx(game: string | null | undefined, stage: HTMLElement, W: number, cy: number): IntroFx {
  if (game === "rocketleague") return boost(stage, W);
  if (game === "counterstrike") return radar(stage);
  if (game === "callofduty") return reticle(stage, cy);
  return { flash: { peak: 0.8, ms: 260 }, sparks: 1, impact: () => undefined };
}
