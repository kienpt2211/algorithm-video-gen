import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import type {SoundEffectPaths} from "../src/algorithm-video/schema";

const run = (args: string[]) => new Promise<void>((resolve, reject) => {
  const child = spawn("ffmpeg", args, {stdio: "ignore"});
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg tạo SFX thất bại với exit code ${code}.`)));
});

const tone = async (output: string, frequency: number, duration: number, volume: number) => {
  await run([
    "-y", "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=44100:duration=${duration}`,
    "-af", `volume=${volume},afade=t=in:st=0:d=0.008,afade=t=out:st=${Math.max(0.01, duration - 0.045)}:d=0.045`,
    "-c:a", "pcm_s16le", output,
  ]);
};

export const createLocalSoundEffects = async (publicDirectory: string, publicPrefix: string): Promise<SoundEffectPaths> => {
  const directory = path.join(publicDirectory, "sfx");
  await fs.mkdir(directory, {recursive: true});
  await Promise.all([
    tone(path.join(directory, "read.wav"), 520, 0.08, 3.5),
    tone(path.join(directory, "write.wav"), 780, 0.14, 4.5),
    tone(path.join(directory, "swap.wav"), 420, 0.2, 4.5),
    tone(path.join(directory, "complete.wav"), 980, 0.48, 4.8),
  ]);
  return {
    read: `${publicPrefix}/sfx/read.wav`,
    write: `${publicPrefix}/sfx/write.wav`,
    swap: `${publicPrefix}/sfx/swap.wav`,
    complete: `${publicPrefix}/sfx/complete.wav`,
  };
};
