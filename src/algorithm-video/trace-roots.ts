import type {ViewSpec} from "./schema";

const rootOf = (expression: string) => expression.match(/[A-Za-z_]\w*/)?.[0] ?? "";

const templateRoots = (text: string) => [...text.matchAll(/\{\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\}/g)]
  .map((match) => rootOf(match[1]));

export const traceRoots = (view: ViewSpec) => {
  const values = new Set<string>();
  for (const visual of view.visuals) {
    values.add(rootOf(visual.variable));
    for (const pointer of visual.pointers) values.add(rootOf(pointer.expression));
  }
  if (view.phase) values.add(rootOf(view.phase.variable));
  for (const effect of Object.values(view.lineEffects)) {
    if (effect.variable) values.add(rootOf(effect.variable));
    for (const expression of effect.indices) values.add(rootOf(expression));
    if (effect.message) for (const root of templateRoots(effect.message)) values.add(root);
  }
  for (const log of view.logs) {
    for (const root of templateRoots(log.text)) values.add(root);
  }
  return [...values].filter((value) => /^[A-Za-z_]\w*$/.test(value));
};
