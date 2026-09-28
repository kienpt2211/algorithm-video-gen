import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import {parseFile} from "music-metadata";

const run = (command: string, args: string[], quiet = false) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, {stdio: quiet ? "ignore" : "inherit"});
  child.on("error", reject);
  child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} thất bại với exit code ${code}.`)));
});

export const createLocalSpeech = async (options: {text: string; voice: string; rate: number; aiffPath: string; mp3Path: string}) => {
  await run("/usr/bin/say", ["-v", options.voice, "-r", String(options.rate), "-o", options.aiffPath, options.text]);
  await run("ffmpeg", ["-y", "-i", options.aiffPath, "-codec:a", "libmp3lame", "-q:a", "2", options.mp3Path], true);
  await fs.unlink(options.aiffPath);
  const metadata = await parseFile(options.mp3Path);
  return metadata.format.duration ?? 0;
};
