import { fxLayer, quiet } from "./fx";

/**
 * Le surlignage qui glisse d'une ligne à l'autre sous la souris, au lieu d'un aplat par ligne qui
 * clignote. Un seul élément pour tout le site, posé par-dessus la page sans capter les clics.
 */
export function watchGlide(): () => void {
  if (quiet() || !matchMedia("(hover: hover) and (pointer: fine)").matches) return () => undefined;
  const layer = fxLayer();
  if (!layer) return () => undefined;
  const thumb = document.createElement("div");
  thumb.className = "fx-glide";
  layer.append(thumb);
  let row: HTMLElement | null = null;
  let frame = 0;

  const place = () => {
    frame = 0;
    if (!row) return;
    const r = row.getBoundingClientRect();
    const wasOff = !thumb.hasAttribute("data-on");
    if (wasOff) thumb.style.transition = "opacity 0.15s";
    thumb.style.transform = `translate(${r.x}px, ${r.y}px)`;
    thumb.style.width = `${r.width}px`;
    thumb.style.height = `${r.height}px`;
    thumb.style.setProperty("--c", getComputedStyle(row).getPropertyValue("--accent"));
    thumb.setAttribute("data-on", "");
    if (wasOff) {
      // La première ligne s'allume sur place : seul le passage d'une ligne à l'autre glisse.
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
  };
  const over = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const next = (e.target as Element | null)?.closest?.<HTMLElement>(".row-hover") ?? null;
    if (next === row) return;
    row = next;
    if (!row) {
      thumb.removeAttribute("data-on");
      return;
    }
    if (!frame) frame = requestAnimationFrame(place);
  };
  const hide = () => {
    row = null;
    thumb.removeAttribute("data-on");
  };
  addEventListener("pointerover", over, { passive: true });
  addEventListener("scroll", hide, { passive: true });
  document.documentElement.addEventListener("pointerleave", hide);
  return () => {
    removeEventListener("pointerover", over);
    removeEventListener("scroll", hide);
    document.documentElement.removeEventListener("pointerleave", hide);
    cancelAnimationFrame(frame);
    thumb.remove();
  };
}
