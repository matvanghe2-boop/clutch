import type { Stream } from "./types";

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
 */
export function embeddable(streams: Stream[], host: string): EmbeddableStream[] {
  const parent = host.replace(/:\d+$/, "");
  return streams.flatMap((s): EmbeddableStream[] => {
    const channel = encodeURIComponent(s.channel);
    if (s.platform === "twitch")
      return [{ label: `Twitch · ${s.channel}`, src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true`, url: s.url }];
    if (s.platform === "kick") return [{ label: `Kick · ${s.channel}`, src: `https://player.kick.com/${channel}`, url: s.url }];
    return [];
  });
}
