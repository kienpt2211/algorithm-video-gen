import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {ExecutionTraceSchema, type ExecutionTrace} from "../src/algorithm-video/schema";
import type {ViewSpec} from "../src/algorithm-video/schema";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type TraceRequest = {
  sourcePath: string;
  inputPath: string;
  jobDirectory: string;
  showStart: number;
  showEnd: number;
  maxSteps?: number;
  timeoutMs?: number;
  maxTraceBytes?: number;
  view?: ViewSpec;
};

export interface Tracer {
  trace(request: TraceRequest): Promise<ExecutionTrace>;
}

const run = (command: string, args: string[], options: {cwd: string; timeoutMs: number}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {cwd: options.cwd, stdio: "inherit"});
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} vượt timeout ${options.timeoutMs}ms.`));
    }, options.timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} thất bại với exit code ${code}.`));
    });
  });

export class LldbTracer implements Tracer {
  async trace(request: TraceRequest): Promise<ExecutionTrace> {
    const timeoutMs = request.timeoutMs ?? 30_000;
    const sourceCopy = path.join(request.jobDirectory, path.basename(request.sourcePath));
    const inputCopy = path.join(request.jobDirectory, "input.txt");
    const binaryPath = path.join(request.jobDirectory, "program");
    const tracePath = path.join(request.jobDirectory, "trace.json");
    const stdoutPath = path.join(request.jobDirectory, "program.stdout.txt");
    const stderrPath = path.join(request.jobDirectory, "program.stderr.txt");
    await Promise.all([fs.copyFile(request.sourcePath, sourceCopy), fs.copyFile(request.inputPath, inputCopy)]);
    await run("/usr/bin/clang++", ["-std=c++17", "-g", "-O0", sourceCopy, "-o", binaryPath], {cwd: request.jobDirectory, timeoutMs});
    const traceCommand = [
      "trace-run", "--binary", JSON.stringify(binaryPath), "--source", JSON.stringify(sourceCopy),
      "--stdin", JSON.stringify(inputCopy), "--output", JSON.stringify(tracePath),
      "--stdout", JSON.stringify(stdoutPath), "--stderr", JSON.stringify(stderrPath),
      "--show-start", String(request.showStart), "--show-end", String(request.showEnd),
      "--max-steps", String(request.maxSteps ?? 5000),
    ].join(" ");
    await run("/usr/bin/lldb", ["-b", "-o", `command script import ${path.join(projectRoot, "scripts", "lldb_tracer.py")}`, "-o", traceCommand, "-o", "quit"], {cwd: request.jobDirectory, timeoutMs});
    const stat = await fs.stat(tracePath);
    if (stat.size > (request.maxTraceBytes ?? 8_000_000)) throw new Error(`Trace quá lớn: ${stat.size} bytes.`);
    const trace = ExecutionTraceSchema.parse(JSON.parse(await fs.readFile(tracePath, "utf8")));
    if (trace.steps.length === 0) throw new Error("Trace không có bước nào trong file C++.");
    return trace;
  }
}
