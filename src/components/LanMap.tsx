"use client";

import Link from "next/link";
import { useState } from "react";
import { WORLD, WORLD_DOTS } from "@/config/world-dots";

export interface LanPin {
  key: string;
  game: string;
  name: string;
  href?: string;
  place: string;
  /** « 9 – 14 déc. ». */
  dates: string;
  status: "past" | "live" | "next";
  lat: number;
  lon: number;
}

const x = (lon: number) => (lon + 180) / WORLD.step;
const y = (lat: number) => (WORLD.top - lat) / WORLD.step;

/** Un arc entre deux LAN : un peu bombé vers le nord, comme une route aérienne. */
function arc(a: LanPin, b: LanPin): string {
  const [x1, y1, x2, y2] = [x(a.lon), y(a.lat), x(b.lon), y(b.lat)];
  const lift = Math.min(10, Math.hypot(x2 - x1, y2 - y1) * 0.3);
  return `M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - lift} ${x2} ${y2}`;
}

/**
 * La carte des LAN de mes équipes : où elles jouent dans les mois qui viennent, reliées dans
 * l'ordre par jeu, et ce qui se joue en ce moment qui pulse. Les compétitions en ligne, ou dont
 * le lieu n'est pas encore connu, sont listées à côté.
 */
export function LanMap({ pins, elsewhere }: { pins: LanPin[]; elsewhere: { key: string; game: string; name: string; href?: string; dates: string; place: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const games = [...new Set(pins.map((p) => p.game))];
  return (
    <section className="lan" aria-label="Carte des LAN">
      <div className="lan-map panel">
        <svg viewBox={`0 0 ${WORLD.cols} ${WORLD.rows}`} role="img" aria-label="Carte du monde des compétitions de mes équipes">
          <path d={WORLD_DOTS} className="lan-land" />
          {games.map((g) => {
            const route = pins.filter((p) => p.game === g && p.status !== "past");
            return route.slice(1).map((p, i) => <path key={`${g}-${p.key}`} d={arc(route[i], p)} className="lan-route" data-game={g} style={{ "--i": i } as React.CSSProperties} />);
          })}
          {pins.map((p, i) => {
            const dot = (
              <g className="lan-pin" data-game={p.game} data-status={p.status} data-on={hover === p.key ? "" : undefined} transform={`translate(${x(p.lon)} ${y(p.lat)})`} style={{ "--i": i } as React.CSSProperties} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
                {p.status === "live" && <circle r="2.4" className="lan-pulse" />}
                <circle r="1.05" className="lan-dot" />
                <title>{`${p.name} · ${p.place} · ${p.dates}`}</title>
              </g>
            );
            return p.href ? (
              <Link key={p.key} href={p.href} aria-label={`${p.name}, ${p.place}`}>
                {dot}
              </Link>
            ) : (
              <g key={p.key}>{dot}</g>
            );
          })}
        </svg>
      </div>
      <LanList
        items={[
          ...pins.filter((p) => p.status !== "past").map((p) => ({ ...p, elsewhere: false })),
          ...elsewhere.map((e) => ({ ...e, status: "next" as const, elsewhere: true })),
        ]}
        hover={hover}
        setHover={setHover}
      />
    </section>
  );
}

type Item = { key: string; game: string; name: string; href?: string; place: string; dates: string; status: LanPin["status"]; elsewhere: boolean };

/** Les huit prochaines, puis le reste sur demande. */
function LanList({ items, hover, setHover }: { items: Item[]; hover: string | null; setHover: (k: string | null) => void }) {
  const li = (it: Item) => (
    <li key={it.key} data-game={it.game} className={it.elsewhere ? "lan-elsewhere" : undefined} data-on={hover === it.key ? "" : undefined} onMouseEnter={() => setHover(it.key)} onMouseLeave={() => setHover(null)}>
      <Row name={it.name} href={it.href} place={it.place} dates={it.dates} status={it.status} />
    </li>
  );
  const first = items.slice(0, 8);
  const rest = items.slice(8);
  return (
    <div className="lan-side">
      <ul className="lan-list">{first.map(li)}</ul>
      {rest.length > 0 && (
        <details className="lan-more">
          <summary className="text-xs text-faint">
            {rest.length} autre{rest.length > 1 ? "s" : ""}
          </summary>
          <ul className="lan-list mt-2">{rest.map(li)}</ul>
        </details>
      )}
    </div>
  );
}

function Row({ name, href, place, dates, status }: { name: string; href?: string; place: string; dates: string; status: LanPin["status"] }) {
  const body = (
    <>
      <span className="lan-swatch" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-faint">
          {status === "live" ? <b className="text-live">En cours · </b> : null}
          {place}
        </span>
      </span>
      <span className="shrink-0 text-xs text-dim">{dates}</span>
    </>
  );
  return href ? (
    <Link href={href} className="lan-row">
      {body}
    </Link>
  ) : (
    <span className="lan-row">{body}</span>
  );
}
