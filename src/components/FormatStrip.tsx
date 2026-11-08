import { type FormatKind, stageFormat } from "@/lib/format-kind";
import type { Stage } from "@/lib/types";

/**
 * Le format de la compétition en un coup d'œil : une vignette animée par phase (ronde suisse,
 * poules, élimination simple ou double), dans l'ordre. Un clic mène à l'onglet de la phase.
 */
export function FormatStrip({ stages, format }: { stages: Stage[]; format?: string }) {
  const steps = stages.map((s) => ({ s, f: stageFormat(s, format) })).filter(({ f }) => f.kind !== "list");
  if (!steps.length) return null;
  return (
    <section className="fmt" aria-label="Format de la compétition">
      <ol className="fmt-steps">
        {steps.map(({ s, f }, i) => (
          <li key={s.anchor} style={{ "--i": i } as React.CSSProperties}>
            <a href={`#${encodeURIComponent(s.anchor)}`} data-tab-go={s.anchor} className="fmt-step">
              <Schema kind={f.kind} />
              <span className="min-w-0">
                <span className="block text-xs text-faint">{f.stage}</span>
                <b className="display block text-lg leading-tight">{f.label}</b>
                {f.detail && <span className="block text-xs text-dim">{f.detail}</span>}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Une petite figure par format. Les traits se tracent et un point les parcourt (voir fx.css). */
function Schema({ kind }: { kind: FormatKind }) {
  return (
    <svg viewBox="0 0 120 60" className="fmt-fig" data-kind={kind} aria-hidden>
      {kind === "swiss" && (
        <>
          <path className="fmt-draw" d="M14 30 L54 16 M14 30 L54 44 M54 16 L96 8 M54 16 L96 30 M54 44 L96 30 M54 44 L96 52" />
          {[
            [14, 30],
            [54, 16],
            [54, 44],
            [96, 8],
            [96, 30],
            [96, 52],
          ].map(([x, y], i) => (
            <circle key={i} className="fmt-node" cx={x} cy={y} r="4" style={{ "--n": i } as React.CSSProperties} />
          ))}
          <circle className="fmt-dot" r="3" style={{ offsetPath: "path('M14 30 L54 16 L96 8')" }} />
        </>
      )}
      {kind === "single" && (
        <>
          <path className="fmt-draw" d="M6 8 H26 V22 H6 M26 15 H50 M6 38 H26 V52 H6 M26 45 H50 M50 15 V45 M50 30 H78 M78 30 H100" />
          <circle className="fmt-node fmt-gold" cx="104" cy="30" r="5" />
          <circle className="fmt-dot" r="3" style={{ offsetPath: "path('M6 8 H26 V15 H50 V30 H100')" }} />
        </>
      )}
      {kind === "double" && (
        <>
          <path className="fmt-draw" d="M6 16 H46 H82 V30 H104" />
          <path className="fmt-draw fmt-lower" d="M26 16 V46 H82 V30" />
          <circle className="fmt-node fmt-gold" cx="108" cy="30" r="5" />
          <circle className="fmt-dot" r="3" style={{ offsetPath: "path('M6 16 H26 V46 H82 V30 H104')" }} />
        </>
      )}
      {kind === "gsl" &&
        [
          [4, 4],
          [62, 4],
          [4, 32],
          [62, 32],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path className="fmt-draw" style={{ "--n": i } as React.CSSProperties} d="M2 6 H30 V13 H48 M14 6 V20 H30 V13" />
            <circle className="fmt-node" cx="50" cy="13" r="3" style={{ "--n": i } as React.CSSProperties} />
          </g>
        ))}
      {kind === "groups" && (
        <>
          <rect className="fmt-draw" x="6" y="6" width="40" height="22" rx="4" />
          <rect className="fmt-draw" x="6" y="33" width="40" height="22" rx="4" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={`a${i}`} className="fmt-node" cx={14 + i * 8} cy="17" r="2.6" style={{ "--n": i } as React.CSSProperties} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={`b${i}`} className="fmt-node" cx={14 + i * 8} cy="44" r="2.6" style={{ "--n": i + 2 } as React.CSSProperties} />
          ))}
          <path className="fmt-draw" d="M46 17 H70 V30 H100 M46 44 H70 V30" />
          <circle className="fmt-node fmt-gold" cx="104" cy="30" r="5" />
        </>
      )}
      {kind === "league" &&
        [0, 1, 2, 3, 4].map((i) => (
          <g key={i} className="fmt-row" style={{ "--n": i } as React.CSSProperties}>
            <rect x="8" y={6 + i * 10} width={96 - i * 12} height="6" rx="3" className={i < 2 ? "fmt-bar fmt-up" : "fmt-bar"} />
          </g>
        ))}
    </svg>
  );
}
