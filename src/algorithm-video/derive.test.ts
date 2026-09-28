import assert from "node:assert/strict";
import test from "node:test";
import {deriveEvent, evaluateIndex} from "./derive";
import {ExecutionTraceSchema, ViewSpecSchema} from "./schema";
import {buildTimeline, totalTimelineFrames} from "./timeline";

const view = ViewSpecSchema.parse({
  version: 1, title: "TEST", sourceFile: "test.cpp", show: {startLine: 1, endLine: 10},
  visuals: [{id: "data", label: "DATA", type: "array-bars", variable: "a", pointers: [{label: "J", expression: "j + 1"}]}],
  counters: [{id: "swaps", label: "SWAPS", line: 4}],
});

const trace = ExecutionTraceSchema.parse({version: 1, sourceFile: "test.cpp", stdout: "", exitCode: 0, truncated: false, steps: [{
  index: 0, line: 4, displayLine: 4, function: "main", depth: 0,
  before: {a: [5, 4, 3], j: 0}, after: {a: [4, 5, 3], j: 0},
}]});

test("schema accepts a generic trace and view", () => assert.equal(trace.steps.length, 1));
test("safe index expressions support offsets", () => assert.equal(evaluateIndex("j + 1", {j: 2}), 3));
test("array swaps are inferred from snapshots", () => assert.deepEqual(deriveEvent(trace.steps[0], view).indices, [0, 1]));
test("one configured step can read and write multiple visuals", () => {
  const multiView = ViewSpecSchema.parse({
    version: 1,
    title: "PREFIX SUM",
    sourceFile: "prefix-sum.cpp",
    show: {startLine: 1, endLine: 10},
    layout: "stacked",
    visuals: [
      {id: "input", label: "INPUT", type: "array-cells", variable: "a"},
      {id: "prefix", label: "PREFIX", type: "array-cells", variable: "prefix"},
    ],
    lineEffects: {
      4: {
        actions: [
          {kind: "read", variable: "a", indices: ["i"]},
          {kind: "read", variable: "prefix", indices: ["i"]},
          {kind: "write", variable: "prefix", indices: ["i + 1"]},
        ],
      },
    },
  });
  const event = deriveEvent({
    index: 0,
    line: 4,
    displayLine: 4,
    function: "main",
    depth: 0,
    before: {a: [2, 3], prefix: [0, 0, 0], i: 0},
    after: {a: [2, 3], prefix: [0, 2, 0], i: 0},
  }, multiView);
  assert.equal(event.kind, "write");
  assert.deepEqual(event.actions, [
    {kind: "read", variable: "a", indices: [0]},
    {kind: "read", variable: "prefix", indices: [0]},
    {kind: "write", variable: "prefix", indices: [1]},
  ]);
});
test("timeline derives counters and deterministic frames", () => {
  const timeline = buildTimeline(trace, view);
  assert.equal(timeline[0].counters.swaps, 1);
  assert.equal(totalTimelineFrames(timeline), Math.max(view.timing.changeFrames, view.timing.endFrames));
});

test("timeline keeps the final steps readable after earlier repetitions accelerate", () => {
  const repeatedTrace = ExecutionTraceSchema.parse({
    version: 1,
    sourceFile: "test.cpp",
    stdout: "",
    exitCode: 0,
    truncated: false,
    steps: Array.from({length: 6}, (_, index) => ({
      index,
      line: 2,
      displayLine: 2,
      function: "main",
      depth: 0,
      before: {a: [1], i: index},
      after: {a: [1], i: index},
    })),
  });
  const timedView = ViewSpecSchema.parse({
    version: 1,
    title: "TEST",
    sourceFile: "test.cpp",
    show: {startLine: 1, endLine: 3},
    visuals: [{id: "data", label: "DATA", type: "array-cells", variable: "a"}],
    timing: {firstOccurrences: 1, normalFrames: 18, fastFrames: 5, changeFrames: 24, endFrames: 54, tailSteps: 2},
  });
  const timeline = buildTimeline(repeatedTrace, timedView);
  assert.deepEqual(timeline.map((step) => step.durationInFrames), [18, 5, 5, 5, 18, 54]);
});

test("narration cues produce word captions and can target the ending", () => {
  const timeline = buildTimeline(trace, view, [{at: "end", occurrence: 1, text: "Đã hoàn tất", audioPath: "done.mp3", durationInFrames: 75}]);
  assert.equal(timeline[0].narrationText, "Đã hoàn tất");
  assert.deepEqual(timeline[0].captions.map((caption) => caption.text), ["Đã", " hoàn", " tất"]);
  assert.equal(totalTimelineFrames(timeline), 75);
});
