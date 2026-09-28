import assert from "node:assert/strict";
import test from "node:test";
import {getSoundEffectCue, getSoundEffectPath} from "./sound-effects";

const paths = {
  read: "read.wav",
  write: "write.wav",
  swap: "swap.wav",
  complete: "complete.wav",
};

test("maps every trace event to its matching sound", () => {
  assert.equal(getSoundEffectPath(paths, "read", false), "read.wav");
  assert.equal(getSoundEffectPath(paths, "none", false), "read.wav");
  assert.equal(getSoundEffectPath(paths, "swap", false), "swap.wav");
  assert.equal(getSoundEffectPath(paths, "write", false), "write.wav");
});

test("complete sound overrides the final trace event", () => {
  assert.equal(getSoundEffectCue("read", true), "complete");
  assert.equal(getSoundEffectCue("swap", true), "complete");
  assert.equal(getSoundEffectCue("write", true), "complete");
  assert.equal(getSoundEffectPath(paths, "write", true), "complete.wav");
});
