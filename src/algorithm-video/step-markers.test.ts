import assert from "node:assert/strict";
import test from "node:test";
import {ViewSpecSchema} from "./schema";
import {resolveStepMarkers, sourceStepLines} from "./step-markers";

const source = [
  "int main() {",
  "  int total = 0;",
  "  // @step accumulate",
  "  total += 3;",
  "}",
].join("\n");

test("step markers resolve to the next executable source line", () => {
  assert.equal(sourceStepLines(source).get("accumulate"), 4);
});

test("step effects and counters resolve without numeric line coupling", () => {
  const view = ViewSpecSchema.parse({
    version: 1,
    title: "Marker",
    sourceFile: "marker.cpp",
    show: {startLine: 1, endLine: 5},
    visuals: [{id: "state", label: "State", type: "scalars", variable: "state"}],
    stepEffects: {
      accumulate: {
        actions: [{kind: "write", variable: "state", indices: []}],
        message: "update state",
      },
    },
    counters: [{id: "updates", label: "UPDATES", step: "accumulate"}],
  });

  const resolved = resolveStepMarkers(source, view);
  assert.equal(resolved.lineEffects["4"].message, "update state");
  assert.equal(resolved.counters[0].line, 4);
});

test("missing step markers fail with an actionable error", () => {
  const view = ViewSpecSchema.parse({
    version: 1,
    title: "Marker",
    sourceFile: "marker.cpp",
    show: {startLine: 1, endLine: 5},
    visuals: [{id: "state", label: "State", type: "scalars", variable: "state"}],
    stepEffects: {missing: {kind: "read"}},
  });
  assert.throws(() => resolveStepMarkers(source, view), /Không tìm thấy marker/);
});
