import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {NarrationSchema, ViewSpecSchema, type AlgorithmVideoProps} from "../src/algorithm-video/schema";
import {resolveStepMarkers} from "../src/algorithm-video/step-markers";
import {buildTimeline, totalTimelineFrames, type AudioCue} from "../src/algorithm-video/timeline";
import {createLocalSpeech} from "./local-tts";
import {createLocalSoundEffects} from "./local-sfx";
import {InstrumentedTracer} from "./instrumented-tracer";

const FPS = 30;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argument = (name: string) => { const index = process.argv.indexOf(name); return index === -1 ? undefined : process.argv[index + 1]; };
const flag = (name: string) => process.argv.includes(name);
const safeSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "algorithm";
const run = (command: string, args: string[], cwd: string) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, {cwd, stdio: "inherit"});
  child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} thất bại với exit code ${code}.`)));
});

const runProgram = (binary: string, input: string, cwd: string, timeoutMs = 10_000) => new Promise<{stdout: string; stderr: string; exitCode: number}>((resolve, reject) => {
  const child = spawn(binary, [], {cwd, stdio: ["pipe", "pipe", "pipe"]});
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); }); child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Chương trình C++ vượt timeout khi kiểm tra output.")); }, timeoutMs);
  child.on("error", (error) => { clearTimeout(timer); reject(error); });
  child.on("exit", (code) => { clearTimeout(timer); resolve({stdout, stderr, exitCode: code ?? -1}); });
  child.stdin.end(input);
});

const main = async () => {
  const sourceArg = argument("--source"); const inputArg = argument("--input"); const viewArg = argument("--view");
  if (!sourceArg || !inputArg || !viewArg) throw new Error("Cần --source, --input và --view.");
  const sourcePath = path.resolve(sourceArg); const inputPath = path.resolve(inputArg); const viewPath = path.resolve(viewArg);
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const view = resolveStepMarkers(sourceText, ViewSpecSchema.parse(JSON.parse(await fs.readFile(viewPath, "utf8"))));
  const narrationPath = argument("--narration") ? path.resolve(argument("--narration")!) : null;
  const narration = NarrationSchema.parse(narrationPath ? JSON.parse(await fs.readFile(narrationPath, "utf8")) : {});
  const requestedJob = argument("--job");
  const jobId = requestedJob ? safeSlug(requestedJob) : `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSlug(view.title)}`;
  const jobDirectory = path.join(projectRoot, "jobs", jobId); const publicDirectory = path.join(projectRoot, "public", "generated", jobId);
  await Promise.all([fs.mkdir(jobDirectory, {recursive: true}), fs.mkdir(publicDirectory, {recursive: true}), fs.mkdir(path.join(projectRoot, "renders"), {recursive: true})]);
  await Promise.all([fs.copyFile(viewPath, path.join(jobDirectory, "view.json")), ...(narrationPath ? [fs.copyFile(narrationPath, path.join(jobDirectory, "narration.json"))] : [])]);

  console.log("1/4 Biên dịch và ghi trace trên bản sao...");
  const trace = await new InstrumentedTracer().trace({sourcePath, inputPath, jobDirectory, showStart: view.show.startLine, showEnd: view.show.endLine, view});
  const originalRun = await runProgram(path.join(jobDirectory, "program"), await fs.readFile(inputPath, "utf8"), jobDirectory);
  const outputMatches = originalRun.exitCode === trace.exitCode && originalRun.stdout === trace.stdout;
  await fs.writeFile(path.join(jobDirectory, "verification.json"), `${JSON.stringify({outputMatches, traced: {exitCode: trace.exitCode, stdout: trace.stdout}, normal: originalRun}, null, 2)}\n`);
  if (!outputMatches) throw new Error("Output khi trace không khớp lần chạy bình thường; dừng trước render.");

  console.log(flag("--no-audio") ? "2/4 Bỏ qua giọng đọc." : "2/4 Tạo giọng đọc local...");
  const audioCues: AudioCue[] = [];
  const voice = argument("--voice") ?? "Linh"; const rate = Number(argument("--rate") ?? "185");
  if (!Number.isFinite(rate) || rate < 100 || rate > 350) throw new Error("--rate phải trong khoảng 100 đến 350.");
  for (const [index, cue] of narration.cues.entries()) {
    if (flag("--no-audio")) break;
    const base = `cue-${String(index).padStart(2, "0")}`; const mp3 = path.join(publicDirectory, `${base}.mp3`);
    const seconds = await createLocalSpeech({text: cue.text, voice, rate, aiffPath: path.join(publicDirectory, `${base}.aiff`), mp3Path: mp3});
    audioCues.push({at: cue.at, line: cue.line, occurrence: cue.occurrence, text: cue.text, audioPath: `generated/${jobId}/${base}.mp3`, durationInFrames: Math.ceil((seconds + 0.55) * FPS)});
  }

  const soundEffects = flag("--no-audio") || flag("--no-sfx")
    ? null
    : await createLocalSoundEffects(publicDirectory, `generated/${jobId}`);

  console.log("3/4 Dựng timeline và props...");
  const allLines = sourceText.split(/\r?\n/); const sourceLines = allLines.slice(view.show.startLine - 1, view.show.endLine).map((text, offset) => ({number: view.show.startLine + offset, text}));
  const steps = buildTimeline(trace, view, audioCues); const totalFrames = totalTimelineFrames(steps);
  const props: AlgorithmVideoProps = {trace, view, sourceLines, steps, totalFrames, soundEffects};
  const propsPath = path.join(jobDirectory, "props.json"); await fs.writeFile(propsPath, `${JSON.stringify(props, null, 2)}\n`);
  if (flag("--no-render")) { console.log(`4/4 Đã chuẩn bị ${trace.steps.length} bước: ${propsPath}`); return; }

  const output = path.resolve(argument("--output") ?? path.join(projectRoot, "renders", `${safeSlug(view.title)}.mp4`));
  await fs.mkdir(path.dirname(output), {recursive: true}); console.log("4/4 Render video dọc...");
  await run(path.join(projectRoot, "node_modules", ".bin", "remotion"), ["render", "AlgorithmTraceVideo", output, `--props=${propsPath}`, "--codec=h264"], projectRoot);
  console.log(`Hoàn tất: ${output}`);
};

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
