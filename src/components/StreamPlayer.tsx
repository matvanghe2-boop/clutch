"use client";

import { useState } from "react";
import type { EmbeddableStream } from "@/lib/streams";

/** Le stream dans la page, avec un onglet par chaîne quand il y en a plusieurs (langues, plateformes). */
export function StreamPlayer({ streams }: { streams: EmbeddableStream[] }) {
  const [current, setCurrent] = useState(0);
  const stream = streams[current] ?? streams[0];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
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
        <iframe
          key={stream.src}
          src={stream.src}
          title={`Stream ${stream.label}`}
          className="absolute inset-0 size-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="flex justify-end px-3 py-2 text-xs">
        <a href={stream.url} target="_blank" rel="noopener noreferrer" className="text-faint hover:text-dim">
          Ouvrir {stream.label} à part ↗
        </a>
      </div>
    </div>
  );
}
