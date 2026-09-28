import assert from "node:assert/strict";
import test from "node:test";
import {visibleCandidatesByLine} from "./cpp-scope";

test("loop-local variables disappear after their closing brace", () => {
  const source = [
    "int main() {",
    "  int total = 0, right = 3;",
    "  for (int i = 0; i < right; i++) {",
    "    total += i;",
    "  }",
    "  int answer = total;",
    "}",
  ].join("\n");
  const visible = visibleCandidatesByLine(source, ["total", "right", "i", "answer"]);
  assert.deepEqual(visible.get(4), ["total", "right", "i"]);
  assert.deepEqual(visible.get(6), ["total", "right", "answer"]);
});
