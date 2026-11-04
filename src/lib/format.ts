import { TIMEZONE } from "@/config/follow";

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, ...o });
const keyFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit" });
const longDayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortFmt = fmt({ day: "numeric", month: "short" });
const shortYearFmt = fmt({ day: "numeric", month: "short", year: "numeric" });
const shortDayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });

const d = (ts: number) => new Date(ts * 1000);

/** AAAA-MM-JJ dans le fuseau d'affichage : sert à regrouper par jour. */
export function dayKey(ts: number): string {
  const p = keyFmt.formatToParts(d(ts));
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function dayLabel(ts: number, now: number): string {
  const k = dayKey(ts);
  if (k === dayKey(now)) return "Aujourd'hui";
  if (k === dayKey(now + 86400)) return "Demain";
  if (k === dayKey(now - 86400)) return "Hier";
  const s = longDayFmt.format(d(ts));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const clock = (ts: number) => timeFmt.format(d(ts));

/** Version courte de dayLabel pour les listes : « Demain », « mar. 10 nov ». */
export function shortDay(ts: number, now: number): string {
  const k = dayKey(ts);
  if (k === dayKey(now)) return "Aujourd'hui";
  if (k === dayKey(now + 86400)) return "Demain";
  if (k === dayKey(now - 86400)) return "Hier";
  return shortDayFmt.format(d(ts)).replace(/\.(?= |$)/g, "");
}

export function shortDate(ts: number, now: number): string {
  return (Math.abs(now - ts) > 300 * 86400 ? shortYearFmt : shortFmt).format(d(ts)).replace(".", "");
}

/** « dans 2 h 15 », « dans 3 j », « il y a 12 min ». */
export function relative(ts: number, now: number): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  let s: string;
  if (abs < 60) s = "moins d'1 min";
  else if (abs < 3600) s = `${Math.round(abs / 60)} min`;
  else if (abs < 86400) {
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    s = m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  } else s = `${Math.round(abs / 86400)} j`;
  return diff >= 0 ? `dans ${s}` : `il y a ${s}`;
}

/** Dates d'infobox « 2026-09-15 » → « 15 sept ». */
export function infoDate(s: string | undefined, now: number): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return shortDate(Date.UTC(+m[1], +m[2] - 1, +m[3], 12) / 1000, now);
}
