import { quiet, sober } from "./fx";

/**
 * Le fond vivant : une scène par jeu, dessinée sur un canvas derrière la page, très discrète.
 *   Rocket League  des traînées de boost qui filent en biais, et la balle qui rebondit ;
 *   Counter-Strike un radar qui balaie, des fumigènes et des rafales de traçantes ;
 *   Call of Duty   une trame de balayage, un viseur qui suit la souris et la mini-carte du drone ;
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
  // Les trois jeux, ou les couleurs de l'équipe préférée quand il y en a une.
  const style = getComputedStyle(document.documentElement);
  const favA = style.getPropertyValue("--fav-a").trim();
  const favB = style.getPropertyValue("--fav-b").trim();
  const COLORS = favA ? [favA, favB || favA, "#ffffff"] : ["#4c8dff", "#f4a62a", "#9be15d"];
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

/** Rocket League : la balle, qui rebondit d'un bord à l'autre avec sa traîne. La souris la frappe. */
function ball(pointer: Pointer, small: boolean): Draw {
  let b: { x: number; y: number; vx: number; vy: number } | null = null;
  const trail: { x: number; y: number }[] = [];
  return (c, w, h, _t, dt, color) => {
    const r = small ? 9 : 13;
    b ??= { x: w * 0.18, y: h * 0.55, vx: 280, vy: -220 };
    b.vy += 170 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < r) {
      b.x = r;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > w - r) {
      b.x = w - r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < r) {
      b.y = r;
      b.vy = Math.abs(b.vy);
    }
    // Au sol, la balle repart toujours assez haut : la scène ne s'éteint jamais.
    if (b.y > h - r) {
      b.y = h - r;
      b.vy = -Math.max(small ? 260 : 360, Math.abs(b.vy) * 0.92);
    }
    if (pointer.active) {
      const dx = b.x - pointer.x;
      const dy = b.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && d > 0) {
        b.vx += (dx / d) * 900 * dt * 6;
        b.vy += (dy / d) * 900 * dt * 6;
      }
    }
    const speed = Math.hypot(b.vx, b.vy);
    const max = small ? 520 : 760;
    if (speed > max) {
      b.vx *= max / speed;
      b.vy *= max / speed;
    }
    if (Math.abs(b.vx) < 160) b.vx = Math.sign(b.vx || 1) * 160;

    trail.push({ x: b.x, y: b.y });
    if (trail.length > (small ? 16 : 26)) trail.shift();
    c.globalCompositeOperation = "lighter";
    trail.forEach((p, i) => {
      const k = i / trail.length;
      c.fillStyle = alpha(color, 0.16 * k);
      c.beginPath();
      c.arc(p.x, p.y, r * (0.25 + 0.75 * k), 0, Math.PI * 2);
      c.fill();
    });
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3.2);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.28, alpha(color, 0.3));
    g.addColorStop(1, alpha(color, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(b.x, b.y, r * 3.2, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "rgba(235,242,255,0.55)";
    c.beginPath();
    c.arc(b.x, b.y, r * 0.62, 0, Math.PI * 2);
    c.fill();
  };
}

/** Counter-Strike : des fumigènes qui éclosent et se dissipent, et des rafales de traçantes. */
function smoke(_pointer: Pointer, small: boolean): Draw {
  type Cloud = { x: number; y: number; born: number; puffs: { dx: number; dy: number; r: number }[] };
  const clouds: Cloud[] = [];
  const shots: { x0: number; y0: number; x1: number; y1: number; at: number }[] = [];
  let nextCloud = 1.2;
  let nextBurst = 0.8;
  const LIFE = 15;
  return (c, w, h, t) => {
    if (t > nextCloud) {
      nextCloud = t + rand(5, 9);
      clouds.push({ x: rand(0.08, 0.92) * w, y: rand(0.3, 0.95) * h, born: t, puffs: Array.from({ length: small ? 5 : 8 }, () => ({ dx: rand(-1, 1), dy: rand(-0.6, 0.6), r: rand(0.55, 1) })) });
      if (clouds.length > 3) clouds.shift();
    }
    for (const cl of clouds) {
      const age = t - cl.born;
      if (age > LIFE) continue;
      const grow = 1 - Math.pow(1 - Math.min(1, age / 1.6), 3);
      const fade = age < LIFE - 4 ? 1 : (LIFE - age) / 4;
      const R = (small ? 70 : 125) * (0.35 + 0.65 * grow);
      for (const p of cl.puffs) {
        const px = cl.x + p.dx * R * 0.75 + Math.sin(t * 0.35 + p.dx * 5) * 7;
        const py = cl.y + p.dy * R * 0.5 - age * 2.5;
        const g = c.createRadialGradient(px, py, 0, px, py, R * p.r);
        g.addColorStop(0, `rgba(205,212,226,${0.075 * fade})`);
        g.addColorStop(1, "rgba(205,212,226,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, R * p.r, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Une rafale : trois à cinq balles traçantes, du bord vers le milieu de l'écran.
    if (t > nextBurst) {
      nextBurst = t + rand(1.4, small ? 5 : 3.6);
      const left = Math.random() < 0.5;
      const y0 = rand(0.2, 0.9) * h;
      const x1 = left ? rand(0.45, 1.05) * w : rand(-0.05, 0.55) * w;
      const y1 = y0 + rand(-90, 90);
      const n = Math.floor(rand(3, 6));
      for (let i = 0; i < n; i++) shots.push({ x0: left ? -30 : w + 30, y0: y0 + rand(-6, 6), x1, y1: y1 + rand(-14, 14), at: t + i * 0.085 });
    }
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const k = (t - s.at) / 0.22;
      if (k < 0) continue;
      if (k > 1.25) {
        shots.splice(i, 1);
        continue;
      }
      const head = Math.min(1, k);
      const tail = Math.max(0, k - 0.3);
      const hx = s.x0 + (s.x1 - s.x0) * head;
      const hy = s.y0 + (s.y1 - s.y0) * head;
      const tx = s.x0 + (s.x1 - s.x0) * tail;
      const ty = s.y0 + (s.y1 - s.y0) * tail;
      const g = c.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, "rgba(255,210,140,0)");
      g.addColorStop(1, "rgba(255,236,190,0.55)");
      c.strokeStyle = g;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(hx, hy);
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  };
}

/** Call of Duty : la mini-carte du drone (UAV), dans un coin, qui balaie et révèle des ennemis. */
function uav(_pointer: Pointer, small: boolean): Draw {
  const pings: { x: number; y: number; born: number }[] = [];
  let last = 0;
  return (c, w, h, t, _dt, color) => {
    const R = small ? 44 : 68;
    const cx = w - R - (small ? 14 : 34);
    const cy = h - R - (small ? 96 : 40);
    c.strokeStyle = alpha(color, 0.28);
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = alpha(color, 0.12);
    c.beginPath();
    c.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    c.moveTo(cx - R, cy);
    c.lineTo(cx + R, cy);
    c.moveTo(cx, cy - R);
    c.lineTo(cx, cy + R);
    c.stroke();
    const sweep = (t * 1.7) % (Math.PI * 2);
    if ("createConicGradient" in c) {
      const g = c.createConicGradient(sweep - 0.9, cx, cy);
      g.addColorStop(0, alpha(color, 0));
      g.addColorStop(0.9 / (Math.PI * 2), alpha(color, 0.3));
      g.addColorStop(0.9 / (Math.PI * 2) + 0.0005, alpha(color, 0));
      g.addColorStop(1, alpha(color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.fill();
    }
    if (t - last > 0.75) {
      last = t;
      const a = sweep - rand(0, 0.35);
      const d = rand(0.2, 0.92) * R;
      pings.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, born: t });
      if (pings.length > 7) pings.shift();
    }
    for (const p of pings) {
      const age = t - p.born;
      if (age > 2.6) continue;
      c.fillStyle = `rgba(255,59,92,${0.75 * (1 - age / 2.6)})`;
      c.beginPath();
      c.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      c.fill();
    }
    // Le joueur, au centre : une flèche à la couleur de l'équipe.
    c.fillStyle = alpha(color, 0.8);
    c.beginPath();
    c.moveTo(cx, cy - 6);
    c.lineTo(cx + 4.5, cy + 5);
    c.lineTo(cx, cy + 2.5);
    c.lineTo(cx - 4.5, cy + 5);
    c.closePath();
    c.fill();
    c.fillStyle = alpha(color, 0.45);
    c.font = "600 10px system-ui, sans-serif";
    c.fillText("UAV", cx - R, cy - R - 6);
  };
}

/** Plusieurs calques dessinés l'un sur l'autre. */
const layers =
  (...makers: ((p: Pointer, small: boolean) => Draw)[]) =>
  (p: Pointer, small: boolean): Draw => {
    const draws = makers.map((m) => m(p, small));
    return (...args) => draws.forEach((d) => d(...args));
  };

const SCENES: Record<string, (p: Pointer, small: boolean) => Draw> = {
  rocketleague: layers(boost, ball),
  counterstrike: layers(radar, smoke),
  callofduty: layers(scan, uav),
  home: constellation,
};

export function watchBackground(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>(".scene");
  const ambient = document.querySelector<HTMLElement>(".ambient");
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (!canvas || !ambient || quiet() || sober() || saveData) return () => undefined;
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
    // Sans page d'équipe, la lueur prend les couleurs de l'équipe préférée, à défaut celles des jeux.
    ambient.style.setProperty("--glow-a", root ? color : "var(--fav-a, var(--color-rl))");
    ambient.style.setProperty("--glow-b", root ? color : "var(--fav-b, var(--color-cod))");
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
  let elapsed = 0;
  const budget = small ? 1000 / 30 : 0;

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (now - drawn < budget) return;
    drawn = now;
    // Pendant le direct d'une de mes équipes, tout va plus vite et le bord de l'écran bat en rouge.
    const live = document.documentElement.hasAttribute("data-live");
    const dt = Math.min(0.05, (now - last) / 1000) * (live ? 1.8 : 1);
    last = now;
    if (!draw || document.hidden) return;
    elapsed += dt;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, elapsed, dt, color);
    if (live) {
      const beat = 0.5 + 0.5 * Math.sin(elapsed * 2.6);
      const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.8);
      g.addColorStop(0, "rgba(255,59,92,0)");
      g.addColorStop(1, `rgba(255,59,92,${0.1 + beat * 0.12})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
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
  // Une nouvelle équipe préférée : l'accueil redessine sa constellation à ses couleurs.
  const refav = () => {
    if (name === "home") draw = constellation(pointer, small);
  };
  addEventListener("clutch:fav", refav);
  return () => {
    removeEventListener("clutch:fav", refav);
    cancelAnimationFrame(frame);
    mo.disconnect();
    removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", leave);
    removeEventListener("resize", resize);
  };
}
