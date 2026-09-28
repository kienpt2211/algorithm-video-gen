import {z} from "zod";
import type {Caption} from "@remotion/captions";

export type TraceValue = null | boolean | number | string | TraceValue[] | {[key: string]: TraceValue};

export const TraceValueSchema: z.ZodType<TraceValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(TraceValueSchema),
    z.record(z.string(), TraceValueSchema),
  ]),
);

export const SnapshotSchema = z.record(z.string(), TraceValueSchema);

export const TraceStepSchema = z.object({
  index: z.number().int().nonnegative(),
  line: z.number().int().positive(),
  displayLine: z.number().int().positive(),
  function: z.string(),
  depth: z.number().int().nonnegative(),
  before: SnapshotSchema,
  after: SnapshotSchema,
});

export const ExecutionTraceSchema = z.object({
  version: z.literal(1),
  sourceFile: z.string(),
  stdout: z.string(),
  exitCode: z.number().int(),
  truncated: z.boolean(),
  steps: z.array(TraceStepSchema).min(1),
});

export const VisualTypeSchema = z.enum([
  "array-bars",
  "array-cells",
  "grid",
  "stack",
  "queue",
  "string",
  "graph",
  "tree",
  "scalars",
]);

export const StepActionSchema = z.object({
  kind: z.enum(["read", "write", "swap"]),
  variable: z.string().min(1),
  indices: z.array(z.string()).max(2).default([]),
});

const StepEffectSchema = z.object({
  // Legacy single-action fields remain supported so existing fixtures keep working.
  kind: z.enum(["read", "write", "swap", "note"]).default("note"),
  variable: z.string().optional(),
  indices: z.array(z.string()).max(2).default([]),
  actions: z.array(StepActionSchema).default([]),
  message: z.string().optional(),
});

export const ViewSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(80),
  sourceFile: z.string().min(1),
  show: z.object({startLine: z.number().int().positive(), endLine: z.number().int().positive()}),
  credit: z.string().max(60).default("ALGORITHM REEL"),
  labels: z.object({
    running: z.string().default("running"),
    console: z.string().default("console"),
  }).default({running: "running", console: "console"}),
  layout: z.enum(["auto", "single", "stacked", "split"]).default("auto"),
  visuals: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: VisualTypeSchema,
    variable: z.string().min(1),
    pointers: z.array(z.object({label: z.string(), expression: z.string()})).default([]),
    range: z.object({start: z.string(), end: z.string()}).nullable().default(null),
  })).min(1),
  counters: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    line: z.number().int().positive().optional(),
    step: z.string().min(1).optional(),
  }).refine((counter) => counter.line !== undefined || counter.step !== undefined, {
    message: "Counter cần line hoặc step.",
  })).default([]),
  phase: z.object({label: z.string(), variable: z.string()}).nullable().default(null),
  lineEffects: z.record(z.string(), StepEffectSchema).default({}),
  stepEffects: z.record(z.string(), StepEffectSchema).default({}),
  logs: z.array(z.object({
    at: z.enum(["start", "end", "line"]),
    line: z.number().int().positive().optional(),
    step: z.string().min(1).optional(),
    occurrence: z.number().int().positive().default(1),
    level: z.enum(["ok", "warn"]).default("ok"),
    text: z.string().min(1),
  })).default([]),
  timing: z.object({
    firstOccurrences: z.number().int().min(1).max(10).default(2),
    normalFrames: z.number().int().min(6).max(120).default(18),
    fastFrames: z.number().int().min(3).max(60).default(10),
    changeFrames: z.number().int().min(8).max(150).default(24),
    endFrames: z.number().int().min(20).max(180).default(54),
    tailSteps: z.number().int().min(0).max(50).default(8),
  }).default({firstOccurrences: 2, normalFrames: 18, fastFrames: 10, changeFrames: 24, endFrames: 54, tailSteps: 8}),
});

export const NarrationCueSchema = z.object({
  at: z.enum(["start", "end"]).optional(),
  line: z.number().int().positive().optional(),
  occurrence: z.number().int().positive().default(1),
  text: z.string().min(1).max(900),
});

export const NarrationSchema = z.object({cues: z.array(NarrationCueSchema).default([])});

export type Snapshot = z.infer<typeof SnapshotSchema>;
export type TraceStep = z.infer<typeof TraceStepSchema>;
export type ExecutionTrace = z.infer<typeof ExecutionTraceSchema>;
export type ViewSpec = z.infer<typeof ViewSpecSchema>;
export type Narration = z.infer<typeof NarrationSchema>;

export type DerivedAction = {
  kind: "read" | "write" | "swap";
  variable: string;
  indices: number[];
};

export type DerivedEvent = {
  kind: "read" | "write" | "swap" | "none";
  variable: string | null;
  indices: number[];
  actions: DerivedAction[];
  message: string;
};

export type TimelineStep = TraceStep & {
  durationInFrames: number;
  startFrame: number;
  occurrence: number;
  event: DerivedEvent;
  counters: Record<string, number>;
  audioPath: string | null;
  narrationText: string | null;
  captions: Caption[];
};

export type SoundEffectPaths = {
  read: string;
  write: string;
  swap: string;
  complete: string;
};

export type AlgorithmVideoProps = {
  trace: ExecutionTrace;
  view: ViewSpec;
  sourceLines: Array<{number: number; text: string}>;
  steps: TimelineStep[];
  totalFrames: number;
  soundEffects: SoundEffectPaths | null;
};
