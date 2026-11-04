import { GAMES } from "@/config/follow";
import { addDays, calendarData } from "@/lib/calendar";
import { competitionHref } from "@/lib/derive";
import { dayKey } from "@/lib/format";
import { loadSnapshot } from "@/lib/load-snapshot";
import type { GameId } from "@/lib/types";

/**
 * Abonnement agenda (iCalendar) : les matchs de mes équipes et les
 * compétitions où elles jouent. Google Agenda, Apple Calendrier et Outlook
 * relisent l'adresse d'eux-mêmes, toutes les quelques heures.
 */
export const dynamic = "force-dynamic";

/** Durée d'une manche, pour estimer la fin d'un match : l'agenda en a besoin. */
const MINUTES_PER_GAME: Record<GameId, number> = { rocketleague: 10, counterstrike: 55, callofduty: 15 };
const DEFAULT_BEST_OF: Record<GameId, number> = { rocketleague: 5, counterstrike: 3, callofduty: 5 };
/** On garde deux semaines de résultats : utile pour retrouver un match tout juste joué. */
const KEEP_PAST_S = 14 * 86400;

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (ts: number) => new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const uid = (s: string) => `${s.replace(/[^A-Za-z0-9._-]/g, "-")}@clutch`;

/** RFC 5545 : 75 octets par ligne au plus, la suite sur une ligne commençant par une espace. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export async function GET(request: Request) {
  const snap = await loadSnapshot();
  const now = Date.now() / 1000;
  const origin = new URL(request.url).origin;
  const { matches, competitions } = calendarData(snap, now, "mes");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clutch//Calendrier esport//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Clutch",
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const m of matches) {
    if (!m.ours || m.timestamp < now - KEEP_PAST_S) continue;
    const [us, them] = m.teams;
    const bestOf = m.bestOf ?? DEFAULT_BEST_OF[m.game];
    const end = m.timestamp + (MINUTES_PER_GAME[m.game] * bestOf + 15) * 60;
    const score = m.status === "done" && m.scores[0] !== null ? ` (${m.scores[0]}-${m.scores[1]})` : "";
    const summary = `${GAMES[m.game].short} · ${us?.short ?? us?.name} vs ${them?.name ?? "à déterminer"}${score}`;
    const description = [
      m.tournament?.name,
      m.round ?? m.tournament?.stage,
      m.bestOf ? `Bo${m.bestOf}` : null,
      ...m.streams.map((s) => `${s.platform} : ${s.url}`),
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(m.id)}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${utc(m.timestamp)}`,
      `DTEND:${utc(end)}`,
      `SUMMARY:${escape(summary)}`,
      `DESCRIPTION:${escape(description)}`,
      ...(m.tournament?.page ? [`URL:${origin}${competitionHref(m.game, m.tournament.page)}`] : []),
      "END:VEVENT",
    );
  }

  const today = dayKey(now);
  for (const c of competitions) {
    if (c.end < addDays(today, -14)) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(`competition:${c.key}`)}`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART;VALUE=DATE:${c.start.replace(/-/g, "")}`,
      // La fin d'un événement « journée entière » est exclue : on vise le lendemain.
      `DTEND;VALUE=DATE:${addDays(c.end, 1).replace(/-/g, "")}`,
      `SUMMARY:${escape(`${GAMES[c.game].short} · ${c.name}`)}`,
      ...(c.location ? [`LOCATION:${escape(c.location)}`] : []),
      "TRANSP:TRANSPARENT",
      `URL:${origin}${competitionHref(c.game, c.page)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return new Response(`${lines.map(fold).join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="clutch.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
