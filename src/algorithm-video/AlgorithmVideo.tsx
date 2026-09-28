import {Audio} from "@remotion/media";
import {AbsoluteFill, Composition, Easing, Interactive, Sequence, interpolate, staticFile, useCurrentFrame} from "remotion";
import {brand} from "./brand";
import {counterTotals, evaluateIndex, getPath, interpolateTemplate} from "./derive";
import {NarrationCaption} from "./NarrationCaption";
import type {AlgorithmVideoProps, TimelineStep, TraceValue, ViewSpec} from "./schema";
import {getSoundEffectCue, getSoundEffectPath} from "./sound-effects";
import {theme} from "./theme";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

const asArray = (value: TraceValue | undefined): TraceValue[] => Array.isArray(value) ? value : [];
const numeric = (value: TraceValue) => typeof value === "number" ? value : Number(value) || 0;
const assignmentPulse = (localFrame: number, durationInFrames: number) => interpolate(
  interpolate(localFrame, [0, Math.max(1, durationInFrames - 1)], [0, 1], clamp),
  [0, 0.32, 1],
  [0.3, 1, 0.45],
  clamp,
);

const ArrayVisual: React.FC<{step: TimelineStep; visual: ViewSpec["visuals"][number]; localFrame: number; isFinal: boolean; compact: boolean; availableWidth: number}> = ({step, visual, localFrame, isFinal, compact, availableWidth}) => {
  const before = asArray(getPath(step.before, visual.variable));
  const after = asArray(getPath(step.after, visual.variable));
  const data = before.length ? before : after;
  const max = Math.max(1, ...data.map(numeric));
  const progress = interpolate(localFrame, [0, Math.min(22, step.durationInFrames - 1)], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  const gap = compact ? 8 : 12;
  const width = Math.min(compact ? 86 : 116, (availableWidth - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));
  const isBars = visual.type === "array-bars";
  const pulse = assignmentPulse(localFrame, step.durationInFrames);
  const rangeStart = visual.range ? evaluateIndex(visual.range.start, step.before) : null;
  const rangeEnd = visual.range ? evaluateIndex(visual.range.end, step.before) : null;
  const actions = (step.event.actions ?? []).filter((action) => action.variable === visual.variable);
  const activeIndices = new Set(actions.flatMap((action) => action.indices));
  const swap = actions.find((action) => action.kind === "swap" && action.indices.length === 2);

  return <div style={{height: "100%", position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", gap}}>
    {data.map((value, index) => {
      const targetIndex = swap?.indices.includes(index)
        ? swap.indices.find((item) => item !== index) ?? index : index;
      const x = (targetIndex - index) * (width + gap) * progress;
      const active = !isFinal && activeIndices.has(index);
      const inRange = rangeStart !== null && rangeEnd !== null && index >= Math.min(rangeStart, rangeEnd) && index <= Math.max(rangeStart, rangeEnd);
      const writing = active && actions.some((action) => (action.kind === "write" || action.kind === "swap") && action.indices.includes(index));
      const reading = active && !writing;
      const afterValue = after[index] ?? value;
      const shown = swap ? value : progress > 0.55 ? afterValue : value;
      const height = isBars ? (compact ? 42 : 76) + (numeric(shown) / max) * (compact ? 105 : 280) : compact ? 66 : 108;
      return <Interactive.Div name={`${visual.label} ${index}`} key={`${index}-${String(value)}`} style={{
        width, height, flexShrink: 0, position: "relative", borderRadius: isBars ? "12px 12px 4px 4px" : compact ? 9 : 12,
        border: `2px solid ${active ? theme.accent : inRange ? theme.rangeBorder : theme.border}`,
        backgroundColor: writing ? `rgba(0,174,218,${0.42 + pulse * 0.48})` : reading ? theme.accentSoft : inRange ? theme.rangeSoft : theme.accentFaint,
        boxShadow: writing ? `0 0 ${18 + pulse * 28}px rgba(0,174,218,${0.18 + pulse * 0.28})` : active ? "0 0 16px rgba(0,174,218,0.18)" : inRange ? `inset 0 -5px 0 ${theme.rangeGlow}` : "none",
        color: writing ? theme.textOnAccent : theme.text, translate: `${x}px 0px`, zIndex: active ? 2 : 1,
        scale: writing ? 1 + pulse * 0.035 : 1,
        display: "flex", alignItems: isBars ? "flex-start" : "center", justifyContent: "center",
        paddingTop: isBars ? (compact ? 8 : 14) : 0, fontSize: compact ? 21 : 30, fontWeight: 800,
      }}>
        {String(shown)}
        <div style={{position: "absolute", bottom: compact ? -25 : -38, color: theme.muted, fontSize: compact ? 14 : 20, fontWeight: 600}}>{index}</div>
        {!isFinal ? visual.pointers.map((pointer) => evaluateIndex(pointer.expression, step.before) === index ? <div key={pointer.label} style={{position: "absolute", top: compact ? -29 : -42, color: theme.accent, fontSize: compact ? 14 : 18, fontWeight: 800}}>{pointer.label}</div> : null) : null}
      </Interactive.Div>;
    })}
  </div>;
};

const GenericVisual: React.FC<{step: TimelineStep; visual: ViewSpec["visuals"][number]; localFrame: number}> = ({step, visual, localFrame}) => {
  const value = getPath(step.after, visual.variable);
  const type = visual.type;
  const pulse = assignmentPulse(localFrame, step.durationInFrames);
  const actions = (step.event.actions ?? []).filter((action) => action.variable === visual.variable);
  const isAssigned = actions.some((action) => action.kind === "write" || action.kind === "swap");
  const isRead = actions.some((action) => action.kind === "read");
  const changedIndices = new Set(actions.flatMap((action) => action.indices));
  if (type === "grid" && Array.isArray(value)) return <div style={{display: "grid", gap: 8, justifyContent: "center"}}>{value.map((row, rowIndex) => <div key={rowIndex} style={{display: "flex", gap: 8}}>{asArray(row).map((cell, column) => {
    const changed = isAssigned && changedIndices.has(rowIndex) && (changedIndices.size === 1 || changedIndices.has(column));
    return <div key={column} style={{width: 68, height: 68, border: `2px solid ${changed ? theme.accent : theme.border}`, background: changed ? `rgba(0,174,218,${0.32 + pulse * 0.52})` : theme.accentFaint, color: changed ? theme.textOnAccent : theme.text, boxShadow: changed ? `0 0 ${16 + pulse * 28}px rgba(0,174,218,${0.15 + pulse * 0.3})` : "none", scale: changed ? 1 + pulse * 0.08 : 1, display: "grid", placeItems: "center", fontSize: 24, fontWeight: changed ? 900 : 500}}>{String(cell)}</div>;
  })}</div>)}</div>;
  if (type === "string") return <div style={{display: "flex", justifyContent: "center", gap: 8}}>{String(value ?? "").split("").map((char, index) => {
    const changed = isAssigned && changedIndices.has(index);
    return <div key={index} style={{width: 58, height: 72, borderBottom: `3px solid ${theme.accent}`, background: changed ? `rgba(0,174,218,${0.16 + pulse * 0.35})` : "transparent", boxShadow: changed ? `0 12px 24px rgba(0,174,218,${pulse * 0.3})` : "none", scale: changed ? 1 + pulse * 0.06 : 1, display: "grid", placeItems: "center", fontSize: 32}}>{char}</div>;
  })}</div>;
  if (type === "scalars" && value && typeof value === "object" && !Array.isArray(value)) return <div style={{height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", alignContent: "center", gap: 18}}>{Object.entries(value).slice(0, 10).map(([key, item]) => {
    const beforeValue = getPath(step.before, `${visual.variable}.${key}`);
    const changed = isAssigned && JSON.stringify(beforeValue) !== JSON.stringify(item);
    return <div key={key} style={{minHeight: 116, padding: "24px 26px", border: `${changed ? 2 : 1}px solid ${changed ? theme.accent : theme.border}`, background: changed ? `rgba(0,174,218,${0.1 + pulse * 0.22})` : "rgba(0,174,218,0.025)", boxShadow: changed ? `0 0 30px rgba(0,174,218,${pulse * 0.32})` : "none", scale: changed ? 1 + pulse * 0.035 : 1, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between"}}><span style={{color: changed ? theme.accent : theme.muted, fontSize: 22, letterSpacing: "0.05em"}}>{key}</span><strong style={{color: theme.text, fontSize: 34}}>{String(item)}</strong></div>;
  })}</div>;
  const list = Array.isArray(value) ? value : value && typeof value === "object" ? Object.entries(value).map(([key, item]) => `${key}:${String(item)}`) : [value];
  return <div style={{display: "flex", flexDirection: type === "stack" ? "column-reverse" : "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 12}}>{list.slice(0, 20).map((item, index) => {
    const changed = isAssigned && (changedIndices.size === 0 || changedIndices.has(index));
    const reading = isRead && (changedIndices.size === 0 || changedIndices.has(index));
    return <div key={index} style={{minWidth: 64, minHeight: 64, padding: 12, borderRadius: type === "graph" || type === "tree" ? "50%" : 10, border: `2px solid ${changed || reading ? theme.accent : theme.border}`, background: changed ? `rgba(0,174,218,${0.14 + pulse * 0.3})` : reading ? theme.accentFaint : "transparent", boxShadow: changed ? `0 0 24px rgba(0,174,218,${pulse * 0.28})` : reading ? "0 0 16px rgba(0,174,218,0.16)" : "none", scale: changed ? 1 + pulse * 0.06 : 1, display: "grid", placeItems: "center", fontSize: 23}}>{String(item)}</div>;
  })}</div>;
};

const DataPanel: React.FC<{step: TimelineStep; view: ViewSpec; localFrame: number; isFinal: boolean; totalSteps: number}> = ({step, view, localFrame, isFinal, totalSteps}) => {
  const layout = view.layout === "auto" ? (view.visuals.length === 1 ? "single" : "stacked") : view.layout;
  const compact = view.visuals.length > 1;
  const completionPulse = isFinal ? assignmentPulse(localFrame, step.durationInFrames) : 0;
  const impactful = step.event.kind === "swap" || step.event.kind === "write";
  return <Interactive.Div name="Data visualization" style={{position: "absolute", left: 70, right: 70, top: 210, height: 500, border: `1px solid ${isFinal ? theme.accent : theme.border}`, boxShadow: isFinal ? `0 0 ${18 + completionPulse * 34}px rgba(0,174,218,${completionPulse * 0.2})` : impactful ? `0 0 ${10 + assignmentPulse(localFrame, step.durationInFrames) * 24}px rgba(0,174,218,0.12)` : "none", borderRadius: 22, backgroundColor: theme.panel, padding: compact ? "58px 24px 24px" : "54px 48px 62px", scale: impactful ? interpolate(localFrame, [0, 5, Math.min(18, step.durationInFrames - 1)], [1, 1.014, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)}) : 1}}>
    {!compact ? <div style={{position: "absolute", left: 28, top: 22, color: theme.muted, fontSize: 20, letterSpacing: "0.14em", fontWeight: 800}}>{view.visuals[0].label.toUpperCase()}</div> : null}
    <div style={{position: "absolute", right: 28, top: 20, display: "flex", gap: 14, alignItems: "center"}}>
      <span style={{color: theme.muted, fontSize: 15, fontWeight: 800, letterSpacing: "0.13em"}}>STEP</span>
      <span style={{color: theme.text, fontSize: 24, fontWeight: 900}}>{step.index + 1}<span style={{color: theme.muted, fontSize: 16}}>/{totalSteps}</span></span>
      {isFinal ? <span style={{padding: "8px 13px", borderRadius: 999, background: theme.accent, color: theme.textOnAccent, fontSize: 16, fontWeight: 900, letterSpacing: "0.12em", opacity: completionPulse, scale: 0.92 + completionPulse * 0.08}}>COMPLETE</span> : null}
    </div>
    <div style={{height: "100%", display: "grid", gridTemplateColumns: layout === "split" ? `repeat(${Math.min(2, view.visuals.length)}, minmax(0, 1fr))` : "1fr", gridTemplateRows: layout === "stacked" ? `repeat(${view.visuals.length}, minmax(0, 1fr))` : undefined, gap: compact ? 14 : 0}}>
      {view.visuals.map((visual) => <Interactive.Div name={visual.label} key={visual.id} style={{position: "relative", minHeight: 0, border: compact ? `1px solid ${theme.border}` : "none", borderRadius: compact ? 14 : 0, padding: compact ? "30px 18px 28px" : 0, background: compact ? "rgba(0,174,218,0.025)" : "transparent"}}>
        {compact ? <div style={{position: "absolute", left: 16, top: 10, color: theme.muted, fontSize: 14, letterSpacing: "0.12em", fontWeight: 800}}>{visual.label.toUpperCase()}</div> : null}
        {visual.type === "array-bars" || visual.type === "array-cells"
          ? <ArrayVisual step={step} visual={visual} localFrame={localFrame} isFinal={isFinal} compact={compact} availableWidth={layout === "split" ? 390 : compact ? 820 : 884}/>
          : <GenericVisual step={step} visual={visual} localFrame={localFrame}/>}
      </Interactive.Div>)}
    </div>
  </Interactive.Div>;
};

const Metrics: React.FC<{step: TimelineStep; steps: TimelineStep[]; view: ViewSpec}> = ({step, steps, view}) => {
  const totals = counterTotals(steps, view);
  const phases = view.phase ? [...new Set(steps.map((item) => getPath(item.after, view.phase!.variable)).filter((item) => typeof item === "number" || typeof item === "string").map(String))] : [];
  const currentPhase = view.phase ? String(getPath(step.after, view.phase.variable) ?? "") : "";
  return <div style={{position: "absolute", left: 70, right: 70, top: 742}}>
    {view.counters.length ? <div style={{display: "grid", gridTemplateColumns: `repeat(${view.counters.length}, 1fr)`, gap: 18}}>{view.counters.map((counter) => {
      const current = step.counters[counter.id] ?? 0; const total = totals[counter.id] ?? 0;
      return <div key={counter.id} style={{padding: "16px 20px", borderTop: `1px solid ${theme.border}`}}><div style={{display: "flex", justifyContent: "space-between", color: theme.muted, fontSize: 18, letterSpacing: "0.12em"}}><span>{counter.label}</span><span style={{color: theme.text, fontSize: 24, fontWeight: 900}}>{current}<span style={{color: theme.muted, fontSize: 15}}>/{total}</span></span></div><div style={{height: 4, background: theme.accentFaint, marginTop: 10}}><div style={{height: "100%", width: `${total ? current / total * 100 : 0}%`, background: theme.accent, boxShadow: "0 0 12px rgba(0,174,218,0.38)"}}/></div></div>;
    })}</div> : null}
    {view.phase && phases.length ? <div style={{display: "flex", gap: 10, marginTop: 18, alignItems: "center"}}><span style={{color: theme.muted, fontSize: 18, marginRight: 4}}>{view.phase.label}</span>{phases.slice(0, 12).map((phase) => <div key={phase} style={{minWidth: 48, padding: "8px 11px", textAlign: "center", borderRadius: 999, border: `1px solid ${phase === currentPhase ? theme.accent : theme.border}`, background: phase === currentPhase ? theme.accent : "transparent", color: phase === currentPhase ? theme.textOnAccent : theme.muted, fontWeight: 800}}>{phase}</div>)}</div> : null}
  </div>;
};

const CodePanel: React.FC<{step: TimelineStep; props: AlgorithmVideoProps}> = ({step, props}) => {
  const visible = props.sourceLines;
  const denseCode = visible.length > 14;
  const codeFontSize = visible.length > 17 ? 15 : denseCode ? 17 : 22;
  const activePulse = assignmentPulse(Math.max(0, useCurrentFrame() - step.startFrame), step.durationInFrames);
  return <Interactive.Div name="C++ code" style={{position: "absolute", left: 70, right: 70, top: 934, height: 620, borderRadius: 20, overflow: "hidden", border: `1px solid ${theme.border}`, background: "#070c08", boxShadow: "0 28px 70px rgba(0,0,0,0.24)"}}>
    <div style={{height: 58, display: "flex", alignItems: "center", padding: "0 22px", borderBottom: `1px solid ${theme.border}`, color: theme.muted, fontSize: 18}}>
      <span style={{color: "#e56b72"}}>●</span><span style={{color: "#d6a94f", marginLeft: 8}}>●</span><span style={{color: "#5ba86b", marginLeft: 8}}>●</span>
      <span style={{marginLeft: 24}}>{props.view.sourceFile} — {props.view.labels.running}</span>
    </div>
    <div style={{height: 489, overflow: "hidden", padding: "16px 0 10px", fontSize: codeFontSize, lineHeight: denseCode ? 1.3 : 1.66}}>{visible.map((line) => {
      const active = line.number === step.displayLine;
      return <div key={line.number} style={{display: "grid", gridTemplateColumns: "58px 1fr", padding: "2px 18px 2px 0", borderLeft: `4px solid ${active ? theme.accent : "transparent"}`, background: active ? `rgba(0,174,218,${0.1 + activePulse * 0.08})` : "transparent", color: active ? theme.text : "#8ba2aa", textShadow: active ? "0 0 16px rgba(0,174,218,0.12)" : "none"}}><span style={{textAlign: "right", paddingRight: 16, color: active ? theme.accent : "#405760"}}>{line.number}</span><span style={{whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis"}}>{line.text}</span></div>;
    })}</div>
    <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 72, padding: "0 22px", borderTop: `1px solid ${theme.border}`, background: theme.panelRaised, color: theme.accent, fontSize: 19, display: "flex", alignItems: "center"}}><span style={{color: theme.muted, marginRight: 8}}>&gt;</span>{step.event.message}</div>
  </Interactive.Div>;
};

const Logs: React.FC<{step: TimelineStep; steps: TimelineStep[]; view: ViewSpec}> = ({step, steps, view}) => {
  const lineOccurrence = steps.slice(0, step.index + 1).filter((item) => item.displayLine === step.displayLine).length;
  const visible = view.logs.filter((log) => log.at === "start" || (log.at === "end" && step.index === steps.length - 1) || (log.at === "line" && log.line === step.displayLine && lineOccurrence >= log.occurrence));
  return <div style={{position: "absolute", left: 72, right: 72, top: 1600, color: theme.muted, fontSize: 20, lineHeight: 1.6}}>{visible.slice(-4).map((log, index) => {
    const snapshot = log.at === "start" ? steps[0].after : step.after;
    const counters = log.at === "start" ? steps[0].counters : step.counters;
    return <div key={`${log.text}-${index}`} style={{color: log.level === "warn" ? theme.warn : theme.muted}}>[{log.level}] {interpolateTemplate(log.text, snapshot, counters)}</div>;
  })}</div>;
};

export const AlgorithmVideo: React.FC<AlgorithmVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const step = [...props.steps].reverse().find((item) => frame >= item.startFrame) ?? props.steps[0];
  const localFrame = Math.max(0, frame - step.startFrame);
  const isFinal = step.index === props.steps.length - 1;
  return <AbsoluteFill style={{backgroundColor: theme.background, color: theme.text, fontFamily: theme.mono, overflow: "hidden"}}>
    {props.steps.filter((item) => item.audioPath).map((item) => <Sequence key={item.index} from={item.startFrame} durationInFrames={item.durationInFrames}><Audio src={staticFile(item.audioPath!)}/></Sequence>)}
    {props.soundEffects ? props.steps.map((item) => {
      const isComplete = item.index === props.steps.length - 1;
      const cue = getSoundEffectCue(item.event.kind, isComplete);
      const effect = getSoundEffectPath(props.soundEffects!, item.event.kind, isComplete);
      return <Sequence key={`sfx-${item.index}`} from={item.startFrame} durationInFrames={Math.min(30, item.durationInFrames)}><Audio src={staticFile(effect)} volume={() => item.audioPath ? 0.24 : cue === "complete" ? 0.9 : cue === "read" ? 0.42 : 0.85}/></Sequence>;
    }) : null}
    <div style={{position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 38%, transparent 0%, transparent 48%, rgba(0,0,0,0.54) 100%)"}}/>
    <div style={{position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.12, background: "repeating-linear-gradient(180deg, rgba(0,174,218,0.11) 0px, rgba(0,174,218,0.11) 1px, transparent 1px, transparent 5px)"}}/>
    {(step.event.kind === "swap" || step.event.kind === "write") ? <div style={{position: "absolute", inset: 0, pointerEvents: "none", background: theme.accent, opacity: interpolate(localFrame, [0, 2, 10], [0.08, 0.025, 0], clamp)}}/> : null}
    <Interactive.Div name="Header" style={{position: "absolute", left: 70, right: 70, top: 70, height: 108, borderBottom: `1px solid ${theme.border}`, opacity: interpolate(frame, [0, 10], [0, 1], {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)})}}>
      <div style={{fontSize: 56, fontWeight: 950, letterSpacing: "-0.055em"}}>{props.view.title.toUpperCase()}<span style={{display: "inline-block", width: 18, height: 48, marginLeft: 13, translate: "0px 7px", background: theme.accent, boxShadow: "0 0 20px rgba(0,174,218,0.35)", opacity: interpolate(frame % 30, [0, 14, 15, 29], [1, 1, 0.16, 0.16], clamp)}}/></div>
      <Interactive.Div name="COOJ brand" style={{position: "absolute", right: 0, top: 12, display: "flex", alignItems: "center", gap: 10, color: theme.text, fontSize: 16, letterSpacing: "0.14em", fontWeight: 900}}>
        <span style={{width: 9, height: 9, borderRadius: "50%", background: theme.accent, boxShadow: "0 0 14px rgba(0,174,218,0.65)"}}/>
        {brand.name}
      </Interactive.Div>
    </Interactive.Div>
    <DataPanel step={step} view={props.view} localFrame={localFrame} isFinal={isFinal} totalSteps={props.steps.length}/>
    <Metrics step={step} steps={props.steps} view={props.view}/>
    <CodePanel step={step} props={props}/>
    <Interactive.Div name="COOJ website" style={{position: "absolute", right: 72, top: 1576, color: theme.accent, fontSize: 16, letterSpacing: "0.1em", fontWeight: 800}}>{brand.website}</Interactive.Div>
    <Logs step={step} steps={props.steps} view={props.view}/>
    {props.steps.filter((item) => item.captions.length).map((item) => <Sequence key={`caption-${item.index}`} from={item.startFrame} durationInFrames={item.durationInFrames}><NarrationCaption captions={item.captions} durationInFrames={item.durationInFrames}/></Sequence>)}
  </AbsoluteFill>;
};

const defaultProps: AlgorithmVideoProps = {
  trace: {version: 1, sourceFile: "algorithm.cpp", stdout: "", exitCode: 0, truncated: false, steps: [{index: 0, line: 1, displayLine: 1, function: "main", depth: 0, before: {data: [5, 2, 4, 1]}, after: {data: [2, 5, 4, 1]}}]},
  view: {version: 1, title: "ALGORITHM", sourceFile: "algorithm.cpp", show: {startLine: 1, endLine: 1}, credit: "ALGORITHM REEL", labels: {running: "running", console: "console"}, layout: "auto", visuals: [{id: "data", label: "DATA", type: "array-bars", variable: "data", pointers: [], range: null}], counters: [], phase: null, lineEffects: {}, stepEffects: {}, logs: [], timing: {firstOccurrences: 2, normalFrames: 18, fastFrames: 10, changeFrames: 24, endFrames: 54, tailSteps: 8}},
  sourceLines: [{number: 1, text: "swap(data[0], data[1]);"}],
  steps: [{index: 0, line: 1, displayLine: 1, function: "main", depth: 0, before: {data: [5, 2, 4, 1]}, after: {data: [2, 5, 4, 1]}, occurrence: 1, event: {kind: "swap", variable: "data", indices: [0, 1], actions: [{kind: "swap", variable: "data", indices: [0, 1]}], message: "swap(5, 2)"}, counters: {}, durationInFrames: 90, startFrame: 0, audioPath: null, narrationText: null, captions: []}],
  totalFrames: 90,
  soundEffects: null,
};

export const AlgorithmVideoComposition: React.FC = () => <Composition id="AlgorithmTraceVideo" component={AlgorithmVideo} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={defaultProps} calculateMetadata={({props}) => ({durationInFrames: props.totalFrames})}/>;
