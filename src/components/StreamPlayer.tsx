"use client";

import { useEffect, useState } from "react";
import { closePip, onPipChange, openPip, type PipSide, pipMatch, pipSupported } from "@/lib/pip";
import type { EmbeddableStream } from "@/lib/streams";

export interface Scoreboard {
  id: string;
  us: PipSide;
  them: PipSide;
  score: string;
  live: boolean;
}

/**
 * Le stream dans la page, avec un onglet par chaîne quand il y en a plusieurs (langues, plateformes).
 * Sur Chrome et Edge (ordinateur), « Fenêtre flottante » le sort de la page : il reste au premier
 * plan pendant qu'on fait autre chose, avec le score du match.
 */
export function StreamPlayer({ streams, board }: { streams: EmbeddableStream[]; board?: Scoreboard }) {
  const [current, setCurrent] = useState(0);
  const [floating, setFloating] = useState(false);
  const [canFloat, setCanFloat] = useState(false);
  const stream = streams[current] ?? streams[0];

  useEffect(() => {
    setCanFloat(pipSupported());
    const sync = () => setFloating(Boolean(board && pipMatch() === board.id));
    sync();
    return onPipChange(sync);
  }, [board]);

  const float = async () => {
    if (!board) return;
    if (floating) return closePip();
    await openPip({ id: board.id, src: stream.src, label: stream.label, us: board.us, them: board.them, score: board.score, live: board.live }).catch(() => false);
  };

  return (
    <div className="overflow-hidden panel">
      {streams.length > 1 && (
        <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-line p-1.5" role="tablist">
          {streams.map((s, i) => (
            <button
              key={s.src}
              role="tab"
              aria-selected={i === current}
              onClick={() => setCurrent(i)}
              className={
                i === current
                  ? "shrink-0 rounded-md bg-panel-2 px-3 py-1.5 text-xs font-medium text-ink"
                  : "shrink-0 rounded-md px-3 py-1.5 text-xs text-dim hover:text-ink"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-video bg-black">
        {floating ? (
          <div className="pip-placeholder">
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="2.5" y="4" width="19" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <rect x="11.5" y="10.5" width="8" height="5.5" rx="1" fill="currentColor" />
            </svg>
            <p>Le stream est dans la fenêtre flottante.</p>
            <button type="button" onClick={() => closePip()} className="pip-back">
              Le ramener ici
            </button>
          </div>
        ) : (
          <iframe
            key={stream.src}
            src={stream.src}
            title={`Stream ${stream.label}`}
            className="absolute inset-0 size-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-4 px-3 py-2 text-xs">
        {canFloat && board && (
          <button type="button" onClick={float} className="pip-button">
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="2.5" y="4" width="19" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <rect x="11.5" y="10.5" width="8" height="5.5" rx="1" fill="currentColor" />
            </svg>
            {floating ? "Fermer la fenêtre flottante" : "Fenêtre flottante"}
          </button>
        )}
        <a href={stream.url} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-dim">
          Ouvrir {stream.label} à part ↗
        </a>
      </div>
    </div>
  );
}
