import type {DerivedEvent, Snapshot, TraceStep, TraceValue, ViewSpec} from "./schema";

export const getPath = (snapshot: Snapshot, path: string): TraceValue | undefined => {
  const parts = path.split(".").filter(Boolean);
  let current: TraceValue | undefined = snapshot;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (current && typeof current === "object") {
      current = current[part];
    } else return undefined;
  }
  return current;
};

export const evaluateIndex = (expression: string, snapshot: Snapshot): number | null => {
  const match = expression.trim().match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)(?:\s*([+-])\s*(\d+))?$/);
  if (!match) return null;
  const value = getPath(snapshot, match[1]);
  if (typeof value !== "number") return null;
  const offset = match[3] ? Number(match[3]) * (match[2] === "-" ? -1 : 1) : 0;
  return Math.trunc(value + offset);
};

const equal = (a: TraceValue | undefined, b: TraceValue | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

const arrayDiff = (before: TraceValue[], after: TraceValue[]) => {
  const changed: number[] = [];
  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    if (!equal(before[index], after[index])) changed.push(index);
  }
  return changed;
};

export const deriveEvent = (step: TraceStep, view: ViewSpec): DerivedEvent => {
  const configured = view.lineEffects[String(step.displayLine)];
  if (configured) {
    const indices = configured.indices
      .map((expression) => evaluateIndex(expression, step.before))
      .filter((value): value is number => value !== null);
    const variable = configured.variable ?? view.visuals[0]?.variable ?? null;
    const values = indices.map((index) => {
      const data = variable ? getPath(step.before, variable) : undefined;
      return Array.isArray(data) ? data[index] : undefined;
    });
    const fallback = configured.kind === "swap"
      ? `swap(${values.map(String).join(", ")})`
      : `${configured.kind} ${variable ?? "state"}`;
    return {kind: configured.kind === "note" ? "none" : configured.kind, variable, indices, message: configured.message ?? fallback};
  }

  for (const visual of view.visuals) {
    const before = getPath(step.before, visual.variable);
    const after = getPath(step.after, visual.variable);
    if (equal(before, after)) continue;
    if (Array.isArray(before) && Array.isArray(after)) {
      const indices = arrayDiff(before, after);
      const swapped = indices.length === 2 && equal(before[indices[0]], after[indices[1]]) && equal(before[indices[1]], after[indices[0]]);
      return {
        kind: swapped ? "swap" : "write",
        variable: visual.variable,
        indices,
        message: swapped ? `swap(${String(before[indices[0]])}, ${String(before[indices[1]])})` : `${visual.variable}[${indices.join(", ")}] updated`,
      };
    }
    return {kind: "write", variable: visual.variable, indices: [], message: `${visual.variable} = ${String(after)}`};
  }
  return {kind: "read", variable: null, indices: [], message: `line ${step.displayLine}`};
};

export const counterTotals = (steps: TraceStep[], view: ViewSpec) =>
  Object.fromEntries(view.counters.map((counter) => [counter.id, steps.filter((step) => step.displayLine === counter.line).length]));

export const interpolateTemplate = (text: string, snapshot: Snapshot, counters: Record<string, number>) =>
  text.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = counters[key] ?? getPath(snapshot, key);
    return value === undefined ? `{${key}}` : Array.isArray(value) ? value.join(", ") : String(value);
  });
