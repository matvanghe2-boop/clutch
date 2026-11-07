import { quiet } from "./fx";

/**
 * Le fond vivant : une scène par jeu, dessinée sur un canvas derrière la page, très discrète.
 *   Rocket League  des traînées de boost qui filent en biais ;
 *   Counter-Strike un radar qui balaie, et des échos qui s'allument à son passage ;
 *   Call of Duty   une trame de balayage et un viseur qui suit la souris ;
 *   Accueil        une constellation aux trois couleurs, reliée au curseur.
 * Sur téléphone, moins d'éléments et 30 images par seconde. Tout s'arrête quand l'onglet est
 * masqué, et rien ne se lance pour qui a coupé les animations ou activé l'économie de données.
 */

type Pointer = { x: number; y: number; active: boolean };
type Draw = (c: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number, color: string) => void;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Une couleur `#rrggbb` avec une opacité : les dégradés du canvas ne connaissent pas color-mix. */
function alpha(hex: string, a: number) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex);
  if (!m) return `rgba(255,255,255,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function boost(pointer: Pointer, small: boolean): Draw {
  const angle = -0.32;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  /** `anywhere` : à l'ouverture, la scène est déjà en mouvement au lieu de partir du bord. */
  const make = (w: number, h: number, anywhere: boolean) => {
    const size = rand(0.35, 1);
    return {
      x: anywhere ? rand(-0.2, 1.2) * w : rand(-0.45, -0.1) * w,
      y: anywhere ? rand(0, 1.1) * h : rand(0.1, 1.5) * h,
      speed: rand(280, 820) * size,
      length: rand(160, 520) * size,
      width: rand(1, 3.2) * size,
      alpha: rand(0.28, 0.75) * size,
    };
  };
  let trails: ReturnType<typeof make>[] = [];
  const count = small ? 8 : 20;
  return (c, w, h, _t, dt, color) => {
    while (trails.length < count) trails.push(make(w, h, true));
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    trails = trails.map((s) => {
      s.x += dir.x * s.speed * dt;
      s.y += dir.y * s.speed * dt;
      // La souris dévie les traînées qui passent près d'elle, comme un souffle.
      let bend = 0;
      if (pointer.active) {
        const d = Math.hypot(s.x - pointer.x, s.y - pointer.y);
        if (d < 260) bend = ((260 - d) / 260) * 46 * Math.sign(s.y - pointer.y || 1);
      }
      const hx = s.x;
      const hy = s.y + bend;
      const tx = s.x - dir.x * s.length;
      const ty = s.y - dir.y * s.length;
      const g = c.createLinearGradient(hx, hy, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
      g.addColorStop(0.1, alpha(color, s.alpha));
      g.addColorStop(1, alpha(color, 0));
      c.strokeStyle = g;
      c.lineWidth = s.width;
      c.beginPath();
      c.moveTo(hx, hy);
      c.quadraticCurveTo((hx + tx) / 2, (hy + ty) / 2 + bend * 0.2, tx, ty);
      c.stroke();
      return s.x - s.length > w * 1.1 || s.y + s.length < -40 ? make(w, h, false) : s;
    });
    c.globalCompositeOperation = "source-over";
  };
}

function radar(pointer: Pointer, small: boolean): Draw {
  const blips: { x: number; y: number; born: number; angle: number; lit: number }[] = [];
  let lastSweep = 0;
  let cx = 0;
  let cy = 0;
  return (c, w, h, t, _dt, color) => {
    const R = Math.max(w, h) * (small ? 0.62 : 0.5);
    const homeX = w * (small ? 0.72 : 0.78);
    const homeY = h * 0.3;
    // Le radar se penche à peine vers la souris : assez pour sentir que le fond écoute.
    const aimX = pointer.active ? homeX + (pointer.x - homeX) * 0.05 : homeX;
    const aimY = pointer.active ? homeY + (pointer.y - homeY) * 0.05 : homeY;
    cx = cx ? cx + (aimX - cx) * 0.05 : aimX;
    cy = cy ? cy + (aimY - cy) * 0.05 : aimY;
    const sweep = (t * 0.55) % (Math.PI * 2);

    c.strokeStyle = alpha(color, 0.15);
    c.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      c.beginPath();
      c.arc(cx, cy, (R * i) / 5, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(cx - R, cy);
    c.lineTo(cx + R, cy);
    c.moveTo(cx, cy - R);
    c.lineTo(cx, cy + R);
    c.stroke();

    // Le faisceau, et sa traîne.
    if ("createConicGradient" in c) {
      const g = c.createConicGradient(sweep - 1.15, cx, cy);
      g.addColorStop(0, alpha(color, 0));
      g.addColorStop(1.15 / (Math.PI * 2), alpha(color, 0.28));
      g.addColorStop(1.15 / (Math.PI * 2) + 0.0005, alpha(color, 0));
      g.addColorStop(1, alpha(color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = alpha(color, 0.5);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
    c.stroke();

    // De nouveaux échos, à intervalles irréguliers, sur la trajectoire du faisceau.
    if (t - lastSweep > (small ? 0.9 : 0.45)) {
      lastSweep = t;
      const d = rand(0.18, 0.96) * R;
      const a = sweep + rand(0.05, 0.3);
      blips.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, born: t, angle: a, lit: 0 });
      if (blips.length > 22) blips.shift();
    }
    for (const b of blips) {
      const age = t - b.born;
      if (age > 4) continue;
      const fade = Math.max(0, 1 - age / 4);
      c.fillStyle = alpha(color, 0.65 * fade);
      c.fillRect(b.x - 2.5, b.y - 2.5, 5, 5);
      c.strokeStyle = alpha(color, 0.5 * fade);
      c.lineWidth = 1;
      const ring = 5 + age * 12;
      c.strokeRect(b.x - ring, b.y - ring, ring * 2, ring * 2);
    }
  };
}

function scan(pointer: Pointer, small: boolean): Draw {
  const glitches: { x: number; y: number; w: number; until: number }[] = [];
  let px = 0;
  let py = 0;
  return (c, w, h, t, _dt, color) => {
    // La trame.
    c.fillStyle = alpha(color, 0.028);
    for (let y = (t * 18) % 4; y < h; y += 4) c.fillRect(0, y, w, 1);

    // Le grand balayage, de haut en bas.
    const period = 7;
    const phase = (t % period) / period;
    const y = phase * (h + 280) - 140;
    const band = c.createLinearGradient(0, y - 180, 0, y + 2);
    band.addColorStop(0, alpha(color, 0));
    band.addColorStop(1, alpha(color, 0.13));
    c.fillStyle = band;
    c.fillRect(0, y - 180, w, 182);
    c.fillStyle = alpha(color, 0.5);
    c.fillRect(0, y, w, 1.5);

    // Des fragments d'interface qui clignotent sur le passage du balayage.
    if (Math.random() < (small ? 0.05 : 0.14)) glitches.push({ x: rand(0, w), y: y - rand(0, 160), w: rand(20, 150), until: t + rand(0.1, 0.7) });
    for (let i = glitches.length - 1; i >= 0; i--) {
      const g = glitches[i];
      if (t > g.until) {
        glitches.splice(i, 1);
        continue;
      }
      c.fillStyle = alpha(color, 0.22);
      c.fillRect(g.x, g.y, g.w, 2);
      c.fillRect(g.x, g.y + 5, g.w * 0.4, 1);
    }

    // Les coins d'un viseur, au repos en haut à droite, qui rejoignent la souris en douceur.
    const aimX = pointer.active ? pointer.x : w * 0.74;
    const aimY = pointer.active ? pointer.y : h * 0.3 + Math.sin(t * 0.6) * 14;
    px = px ? px + (aimX - px) * 0.08 : aimX;
    py = py ? py + (aimY - py) * 0.08 : aimY;
    const s = 34 + Math.sin(t * 2.2) * 3;
    const arm = 12;
    c.strokeStyle = alpha(color, 0.5);
    c.lineWidth = 1.5;
    c.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      c.moveTo(px + sx * s, py + sy * (s - arm));
      c.lineTo(px + sx * s, py + sy * s);
      c.lineTo(px + sx * (s - arm), py + sy * s);
    }
    c.stroke();
    c.fillStyle = alpha(color, 0.6);
    c.fillRect(px - 1, py - 1, 2, 2);
    c.strokeStyle = alpha(color, 0.12);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, py);
    c.lineTo(w, py);
    c.moveTo(px, 0);
    c.lineTo(px, h);
    c.stroke();
  };
}

function constellation(pointer: Pointer, small: boolean): Draw {
  const COLORS = ["#4c8dff", "#f4a62a", "#9be15d"];
  const nodes: { x: number; y: number; vx: number; vy: number; c: string; r: number }[] = [];
  return (c, w, h, _t, dt) => {
    const count = small ? 26 : 60;
    while (nodes.length < count) {
      const a = rand(0, Math.PI * 2);
      const v = rand(6, 22);
      nodes.push({ x: rand(0, w), y: rand(0, h), vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: COLORS[nodes.length % 3], r: rand(0.8, 2) });
    }
    const reach = small ? 90 : 130;
    for (const n of nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x < -20) n.x = w + 20;
      if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      if (n.y > h + 20) n.y = -20;
    }
    c.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
        const d = Math.hypot(dx, dy);
        if (d > reach) continue;
        c.strokeStyle = alpha(a.c, 0.16 * (1 - d / reach));
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      if (pointer.active) {
        const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (d < 200) {
          c.strokeStyle = alpha(a.c, 0.42 * (1 - d / 200));
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(pointer.x, pointer.y);
          c.stroke();
        }
      }
      c.fillStyle = alpha(a.c, 0.6);
      c.beginPath();
      c.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      c.fill();
    }
  };
}

const SCENES: Record<string, (p: Pointer, small: boolean) => Draw> = {
  rocketleague: boost,
  counterstrike: radar,
  callofduty: scan,
  home: constellation,
};

export function watchBackground(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>(".scene");
  const ambient = document.querySelector<HTMLElement>(".ambient");
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!canvas || !ambient || quiet() || saveData) return () => undefined;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;

  const small = matchMedia("(pointer: coarse)").matches || innerWidth < 640;
  const pointer: Pointer = { x: 0, y: 0, active: false };
  let w = 0;
  let h = 0;
  const resize = () => {
    const ratio = small ? 1 : Math.min(devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  resize();

  let name = "";
  let color = "#4c8dff";
  let draw: Draw | null = null;
  let current: Element | null | undefined;
  /** Lit la scène voulue par la page : le jeu et la couleur portés par sa racine. */
  const read = () => {
    const root = document.querySelector<HTMLElement>(".page-enter > [data-game]");
    if (root === current) return;
    current = root;
    const wanted = root?.getAttribute("data-game") ?? "home";
    if (root) color = getComputedStyle(root).getPropertyValue("--accent").trim() || color;
    ambient.style.setProperty("--glow-a", root ? color : "var(--color-rl)");
    ambient.style.setProperty("--glow-b", root ? color : "var(--color-cod)");
    if (wanted === name) return;
    name = wanted;
    // Fondu au noir, puis la nouvelle scène : on ne mêle jamais deux dessins.
    canvas.removeAttribute("data-on");
    window.setTimeout(() => {
      draw = (SCENES[wanted] ?? constellation)(pointer, small);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.setAttribute("data-on", "");
    }, draw ? 320 : 0);
  };
  read();

  const mo = new MutationObserver(read);
  const main = document.querySelector("main");
  if (main) mo.observe(main, { childList: true, subtree: true });

  let frame = 0;
  let last = performance.now();
  let drawn = 0;
  const budget = small ? 1000 / 30 : 0;
  const start = last;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (now - drawn < budget) return;
    drawn = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!draw || document.hidden) return;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, (now - start) / 1000, dt, color);
  };
  frame = requestAnimationFrame(loop);

  const move = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
  };
  const leave = () => {
    pointer.active = false;
  };
  addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  addEventListener("resize", resize);
  return () => {
    cancelAnimationFrame(frame);
    mo.disconnect();
    removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", leave);
    removeEventListener("resize", resize);
  };
}
