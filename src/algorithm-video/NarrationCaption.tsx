import type {Caption} from "@remotion/captions";
import {Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {theme} from "./theme";

const WORDS_PER_PAGE = 7;

export const NarrationCaption: React.FC<{captions: Caption[]; durationInFrames: number}> = ({captions, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!captions.length) return null;

  const timeMs = frame / fps * 1000;
  const matchedIndex = captions.findIndex((caption) => caption.startMs <= timeMs && caption.endMs > timeMs);
  const activeIndex = matchedIndex === -1 ? captions.length - 1 : matchedIndex;
  const pageStart = Math.floor(activeIndex / WORDS_PER_PAGE) * WORDS_PER_PAGE;
  const visible = captions.slice(pageStart, pageStart + WORDS_PER_PAGE);

  return <Interactive.Div name="Narration captions" style={{
    position: "absolute", left: 66, right: 66, bottom: 92, minHeight: 122,
    display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
    padding: "22px 34px", borderRadius: 22, border: `1px solid ${theme.border}`,
    background: "rgba(5,8,6,0.92)", boxShadow: "0 20px 60px rgba(0,0,0,0.38)",
    opacity: interpolate(frame, [0, 5, durationInFrames - 7, durationInFrames - 1], [0, 1, 1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.7, 0, 0.84, 0)]}),
    translate: interpolate(frame, [0, 7], ["0px 18px", "0px 0px"], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1)}),
    fontSize: 34, lineHeight: 1.3, fontWeight: 850, letterSpacing: "-0.025em",
  }}>
    <span style={{whiteSpace: "pre-wrap"}}>{visible.map((caption, index) => {
      const absoluteIndex = pageStart + index;
      const active = absoluteIndex === activeIndex;
      return <span key={`${caption.startMs}-${caption.text}`} style={{
        color: active ? theme.accentStrong : theme.text,
        textShadow: active ? "0 0 22px rgba(0,174,218,0.52)" : "none",
      }}>{caption.text}</span>;
    })}</span>
  </Interactive.Div>;
};
