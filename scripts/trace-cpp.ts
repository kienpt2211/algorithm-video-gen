import {promises as fs} from "node:fs";
import path from "node:path";
import {InstrumentedTracer} from "./instrumented-tracer";
import {ViewSpecSchema} from "../src/algorithm-video/schema";
import {resolveStepMarkers} from "../src/algorithm-video/step-markers";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const main = async () => {
  const source = argument("--source");
  const input = argument("--input");
  const viewPath = argument("--view");
  const job = argument("--job");
  if (!source || !input || !viewPath || !job) throw new Error("Cần --source, --input, --view và --job.");
  const sourcePath = path.resolve(source);
  const view = resolveStepMarkers(
    await fs.readFile(sourcePath, "utf8"),
    ViewSpecSchema.parse(JSON.parse(await fs.readFile(path.resolve(viewPath), "utf8"))),
  );
  const jobDirectory = path.resolve(job);
  await fs.mkdir(jobDirectory, {recursive: true});
  await fs.copyFile(path.resolve(viewPath), path.join(jobDirectory, "view.json"));
  const trace = await new InstrumentedTracer().trace({
    sourcePath, inputPath: path.resolve(input), jobDirectory,
    showStart: view.show.startLine, showEnd: view.show.endLine, view,
  });
  console.log(`Trace hoàn tất: ${trace.steps.length} bước, exit ${trace.exitCode}.`);
};

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
