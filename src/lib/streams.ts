import type { FollowedTeam } from "@/config/follow";
import type { Stream } from "./types";

/**
 * Les streams d'un match de mon équipe : ses chaînes françaises d'abord
 * (réglées dans les Réglages), puis les diffusions officielles relevées par
 * Liquipedia, sans doublon.
 */
export function matchStreams(team: FollowedTeam | undefined, official: Stream[]): Stream[] {
  const french: Stream[] = (team?.streams ?? []).map((channel) => ({ platform: "twitch", channel, url: `https://www.twitch.tv/${channel}`, fr: true }));
  const seen = new Set(french.map((f) => f.channel.toLowerCase()));
  return [...french, ...official.filter((o) => !(o.platform === "twitch" && seen.has(o.channel.toLowerCase())))];
}

export interface EmbeddableStream {
  label: string;
  /** Adresse du lecteur intégrable. */
  src: string;
  /** La chaîne sur sa plateforme, pour l'ouvrir à part. */
  url: string;
}

/**
 * Les streams qu'on peut lire dans la page. Twitch exige le nom du site qui
 * l'intègre (`parent`), d'où l'hôte de la requête ; Kick n'exige rien.
 * YouTube n'est pas proposé : Liquipedia ne donne que le nom de la chaîne, pas
 * l'identifiant que réclame son lecteur. Le lien reste dans la liste des streams.
 *
 * `muted` : plusieurs lecteurs côte à côte ne doivent pas parler en même temps.
 */
export function embeddable(streams: Stream[], host: string, { muted = false } = {}): EmbeddableStream[] {
  const parent = host.replace(/:\d+$/, "");
  return streams.flatMap((s): EmbeddableStream[] => {
    const channel = encodeURIComponent(s.channel);
    if (s.platform === "twitch")
      return [{ label: s.fr ? `FR · ${s.channel}` : `Twitch · ${s.channel}`, src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true${muted ? "&muted=true" : ""}`, url: s.url }];
    if (s.platform === "kick") return [{ label: `Kick · ${s.channel}`, src: `https://player.kick.com/${channel}${muted ? "?muted=true" : ""}`, url: s.url }];
    return [];
  });
}
