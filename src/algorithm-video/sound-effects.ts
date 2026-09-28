import type {DerivedEvent, SoundEffectPaths} from "./schema";

export type SoundEffectCue = keyof SoundEffectPaths;

export const getSoundEffectCue = (
  eventKind: DerivedEvent["kind"],
  isComplete: boolean,
): SoundEffectCue => {
  if (isComplete) return "complete";
  if (eventKind === "swap") return "swap";
  if (eventKind === "write") return "write";
  return "read";
};

export const getSoundEffectPath = (
  soundEffects: SoundEffectPaths,
  eventKind: DerivedEvent["kind"],
  isComplete: boolean,
) => soundEffects[getSoundEffectCue(eventKind, isComplete)];
