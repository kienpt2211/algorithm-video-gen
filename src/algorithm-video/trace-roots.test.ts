import assert from "node:assert/strict";
import test from "node:test";
import {ViewSpecSchema} from "./schema";
import {traceRoots} from "./trace-roots";

test("trace roots include variables used only by logs and messages", () => {
  const view = ViewSpecSchema.parse({
    version: 1,
    title: "Search",
    sourceFile: "search.cpp",
    show: {startLine: 1, endLine: 20},
    visuals: [{id: "data", label: "Data", type: "array-cells", variable: "a", pointers: [{label: "M", expression: "mid"}]}],
    lineEffects: {12: {kind: "read", message: "target = {target}"}},
    logs: [{at: "end", text: "result index = {answer}"}, {at: "end", text: "value = {state.value}"}],
  });

  assert.deepEqual(new Set(traceRoots(view)), new Set(["a", "mid", "target", "answer", "state"]));
});
