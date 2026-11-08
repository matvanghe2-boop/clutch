/**
 * Le stream en fenêtre flottante (Document Picture-in-Picture, Chrome et Edge sur ordinateur) :
 * une petite fenêtre toujours au premier plan, hors du navigateur, avec le stream et le score.
 * Elle survit à la navigation dans le site : le score y est mis à jour depuis n'importe quelle
 * page (components/ScoreToast.tsx), et elle se ferme seule à la fin du match.
 */

interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  window: Window | null;
}

export interface PipSide {
  name: string;
  logo?: string;
  color?: string;
}

export interface PipOptions {
  id: string;
  src: string;
  label: string;
  us: PipSide;
  them: PipSide;
  score: string;
  live: boolean;
}

let current: { win: Window; id: string; score: HTMLElement; status: HTMLElement } | null = null;
const listeners = new Set<() => void>();

const api = () => (typeof window !== "undefined" ? (window as Window & { documentPictureInPicture?: PipApi }).documentPictureInPicture : undefined);

export const pipSupported = () => Boolean(api());
export const pipMatch = () => current?.id ?? null;

/** Prévient les lecteurs de la page quand la fenêtre s'ouvre ou se ferme. */
export function onPipChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const changed = () => listeners.forEach((fn) => fn());

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{height:100%;background:#07090d;color:#e9edf5;font:600 13px/1.2 system-ui,sans-serif;overflow:hidden}
body{display:grid;grid-template-rows:auto 1fr}
header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:6px 10px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--a) 30%,#07090d),#07090d 45%,#07090d 55%,color-mix(in srgb,var(--b) 30%,#07090d))}
.side{display:flex;align-items:center;gap:6px;min-width:0}
.side.b{justify-content:flex-end}
.side img{width:20px;height:20px;object-fit:contain}
.side span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.mid{display:grid;justify-items:center}
.score{font:800 italic 20px/1 system-ui,sans-serif;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.status{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#8b93a7}
.status.live{color:#ff3b5c}
.flash{animation:flash .9s ease-out}
@keyframes flash{0%{transform:scale(1.5);color:#fff;text-shadow:0 0 18px var(--a)}100%{transform:none}}
iframe{width:100%;height:100%;border:0;display:block}
`;

function side(doc: Document, s: PipSide, cls: string): HTMLElement {
  const el = doc.createElement("div");
  el.className = `side ${cls}`;
  if (s.logo) {
    const img = doc.createElement("img");
    img.src = s.logo;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    el.append(img);
  }
  const name = doc.createElement("span");
  name.textContent = s.name;
  if (cls === "b") el.prepend(name);
  else el.append(name);
  return el;
}

export async function openPip(o: PipOptions): Promise<boolean> {
  const pip = api();
  if (!pip) return false;
  closePip();
  const win = await pip.requestWindow({ width: 480, height: 312 });
  const doc = win.document;
  doc.title = `${o.us.name} – ${o.them.name}`;
  const style = doc.createElement("style");
  style.textContent = CSS;
  doc.head.append(style);
  doc.body.style.setProperty("--a", o.us.color ?? "#4c8dff");
  doc.body.style.setProperty("--b", o.them.color ?? "#f4a62a");

  const header = doc.createElement("header");
  const mid = doc.createElement("div");
  mid.className = "mid";
  const score = doc.createElement("div");
  score.className = "score";
  score.textContent = o.score;
  const status = doc.createElement("div");
  status.className = o.live ? "status live" : "status";
  status.textContent = o.live ? "● En direct" : o.label;
  mid.append(score, status);
  header.append(side(doc, o.us, "a"), mid, side(doc, o.them, "b"));

  const frame = doc.createElement("iframe");
  frame.src = o.src;
  frame.allow = "autoplay; fullscreen";
  frame.title = `Stream ${o.label}`;
  doc.body.append(header, frame);

  current = { win, id: o.id, score, status };
  win.addEventListener("pagehide", () => {
    if (current?.win === win) current = null;
    changed();
  });
  changed();
  return true;
}

export function closePip() {
  current?.win.close();
  current = null;
  changed();
}

/** Le score a bougé : la fenêtre le montre, avec un éclat. Match fini : la fenêtre le dit, puis se ferme. */
export function pipScore(id: string, score: string, state: "live" | "done", verdict?: string) {
  if (!current || current.id !== id) return;
  const { score: el, status, win } = current;
  if (el.textContent !== score) {
    el.textContent = score;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }
  if (state === "done") {
    status.className = "status";
    status.textContent = verdict ?? "Terminé";
    window.setTimeout(() => {
      if (current?.win === win) closePip();
    }, 90_000);
  }
}
