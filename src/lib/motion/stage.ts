/** Dernière heure, dernière minute : la tension du compte à rebours monte par paliers. */
export type CountdownStage = "calm" | "hour" | "final" | "go";

export function stageOf(secondsLeft: number): CountdownStage {
  if (secondsLeft <= 0) return "go";
  if (secondsLeft <= 60) return "final";
  if (secondsLeft <= 3600) return "hour";
  return "calm";
}
