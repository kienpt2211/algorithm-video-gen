import {deriveEvent} from "./derive";
import type {ExecutionTrace, TimelineStep, ViewSpec} from "./schema";

export type AudioCue = {at?: "start" | "end"; line?: number; occurrence: number; audioPath: string; durationInFrames: number; text: string};

const captionsForCue = (text: string, durationInFrames: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const durationMs = durationInFrames / 30 * 1000;
  return words.map((word, index) => ({
    text: `${index === 0 ? "" : " "}${word}`,
    startMs: index / words.length * durationMs,
    endMs: (index + 1) / words.length * durationMs,
    timestampMs: index / words.length * durationMs,
    confidence: 1,
  }));
};

export const buildTimeline = (trace: ExecutionTrace, view: ViewSpec, audioCues: AudioCue[] = []): TimelineStep[] => {
  const occurrences = new Map<number, number>();
  const counters: Record<string, number> = Object.fromEntries(view.counters.map((counter) => [counter.id, 0]));
  let startFrame = 0;
  return trace.steps.map((step, index) => {
    const occurrence = (occurrences.get(step.displayLine) ?? 0) + 1;
    occurrences.set(step.displayLine, occurrence);
    for (const counter of view.counters) if (counter.line === step.displayLine) counters[counter.id]++;
    const event = deriveEvent(step, view);
    const cue = audioCues.find((item) => item.at === "end"
      ? index === trace.steps.length - 1
      : item.at === "start"
        ? index === 0
        : item.line === undefined
          ? index === 0
          : item.line === step.displayLine && item.occurrence === occurrence);
    const protectedTail = index >= Math.max(0, trace.steps.length - view.timing.tailSteps);
    const accelerated = occurrence > view.timing.firstOccurrences && !protectedTail;
    const base = event.kind === "write" || event.kind === "swap" ? view.timing.changeFrames : accelerated ? view.timing.fastFrames : view.timing.normalFrames;
    const finalHold = index === trace.steps.length - 1 ? view.timing.endFrames : 0;
    const durationInFrames = Math.max(base, finalHold, cue?.durationInFrames ?? 0);
    const result: TimelineStep = {...step, occurrence, event, counters: {...counters}, durationInFrames, startFrame, audioPath: cue?.audioPath ?? null, narrationText: cue?.text ?? null, captions: cue ? captionsForCue(cue.text, cue.durationInFrames) : []};
    startFrame += durationInFrames;
    return result;
  });
};

export const totalTimelineFrames = (steps: TimelineStep[]) =>
  Math.max(1, steps.reduce((sum, step) => sum + step.durationInFrames, 0));
