import {ViewSpecSchema, type ViewSpec} from "./schema";

const markerPattern = /^\s*\/\/\s*@step\s+([A-Za-z][A-Za-z0-9_-]*)\s*$/;

export const sourceStepLines = (source: string) => {
  const lines = source.split(/\r?\n/);
  const markers = new Map<string, number>();

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(markerPattern);
    if (!match) continue;
    const id = match[1];
    if (markers.has(id)) throw new Error(`Marker @step ${id} bị khai báo trùng.`);

    let target = index + 1;
    while (target < lines.length) {
      const trimmed = lines[target].trim();
      if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("#")) break;
      target++;
    }
    if (target >= lines.length) throw new Error(`Marker @step ${id} không có câu lệnh phía sau.`);
    markers.set(id, target + 1);
  }

  return markers;
};

export const resolveStepMarkers = (source: string, view: ViewSpec): ViewSpec => {
  const markers = sourceStepLines(source);
  const lineFor = (step: string) => {
    const line = markers.get(step);
    if (line === undefined) throw new Error(`Không tìm thấy marker // @step ${step} trong mã C++.`);
    return line;
  };

  const lineEffects = {...view.lineEffects};
  for (const [step, effect] of Object.entries(view.stepEffects)) {
    const line = String(lineFor(step));
    if (lineEffects[line]) throw new Error(`Dòng ${line} có cả lineEffects và stepEffects (${step}).`);
    lineEffects[line] = effect;
  }

  return ViewSpecSchema.parse({
    ...view,
    lineEffects,
    counters: view.counters.map((counter) => ({
      ...counter,
      line: counter.step ? lineFor(counter.step) : counter.line,
    })),
    logs: view.logs.map((log) => ({
      ...log,
      line: log.step ? lineFor(log.step) : log.line,
    })),
  });
};
