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

/** Temps passé entre deux dates : « 2 ans 3 mois », « 5 mois », « 3 sem. ». */
export function tenure(fromIso: string | undefined, toIso: string | undefined, now: number): string | undefined {
  const from = fromIso ? Date.parse(fromIso) : NaN;
  const to = toIso ? Date.parse(toIso) : now * 1000;
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return undefined;
  const days = (to - from) / 86_400_000;
  const months = Math.floor(days / 30.44);
  if (months < 1) return days < 7 ? `${Math.max(1, Math.round(days))} j` : `${Math.floor(days / 7)} sem.`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} mois`;
  return `${years} an${years > 1 ? "s" : ""}${rest ? ` ${rest} mois` : ""}`;
}

/** Une place de Liquipedia, à la française : « 1st » → « 1er », « 3rd - 4th » → « 3e–4e », « W » → « V ». */
export function placeFr(place: string): string {
  if (place === "W") return "V";
  if (place === "L") return "D";
  return place
    .replace(/(\d+)(?:st|nd|rd|th)/g, (_, n: string) => (n === "1" ? "1er" : `${n}e`))
    .replace(/\s*-\s*/g, "–");
}

/** Un montant de Liquipedia, à la française : « $646,200 » → « 646 200 $ ». Tel quel s'il est dans une autre forme. */
export function money(value: string | undefined): string | undefined {
  const m = value?.match(/^\$([\d,]+)/);
  if (!m) return value;
  return `${m[1].replace(/,/g, "\u202f")}\u00a0$`;
}

const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

/** « 2024-01-04 » → « janvier 2024 ». */
export function monthYearOf(iso: string | undefined): string | undefined {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? undefined : monthYear.format(new Date(t));
}
