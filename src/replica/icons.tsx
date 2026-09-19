/**
 * The handful of glyphs the studio uses, inlined.
 *
 * The product draws these with `lucide-react`, and the replica may not: it is
 * copied verbatim into a repo that must not grow a dependency to render a
 * 24x24 path, and a film renderer pays for every package it resolves per frame.
 * So the paths are inlined here, traced from the same icons, at lucide's own
 * geometry (24x24 box, 2px stroke, round caps and joins).
 *
 * Source: lucide (https://lucide.dev), ISC licence, Copyright (c) 2020 Lucide
 * Contributors — "Permission to use, copy, modify, and/or distribute this
 * software for any purpose with or without fee is hereby granted". The ISC
 * notice travels with this file, which is the licence's one condition.
 *
 * Everything here is a pure function of props. The one glyph with motion — the
 * drafting spinner — takes its angle from the caller, which takes it from
 * `state.t`; there is no CSS animation anywhere in this directory.
 */

import type { JSX } from "react";

/** The path data, by name. Each entry is a list of `d` strings. */
const PATHS: Record<string, string[]> = {
  home: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
  messages: [
    "M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z",
    "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1",
  ],
  share: ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M16 6l-4-4-4 4", "M12 2v13"],
  image: ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M21 15l-5-5L5 21"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  chevronDown: ["M6 9l6 6 6-6"],
  flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  sliders: [
    "M21 4h-7",
    "M10 4H3",
    "M21 12h-9",
    "M8 12H3",
    "M21 20h-5",
    "M12 20H3",
    "M14 2v4",
    "M8 10v4",
    "M16 18v4",
  ],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  mapPin: ["M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  file: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", "M14 2v4a2 2 0 0 0 2 2h4"],
  fileText: [
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z",
    "M14 2v4a2 2 0 0 0 2 2h4",
    "M9 13h6",
    "M9 17h6",
  ],
  rotate: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  save: [
    "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7",
    "M7 3v4a1 1 0 0 0 1 1h7",
  ],
  x: ["M18 6L6 18", "M6 6l12 12"],
  zoomIn: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3", "M11 8v6", "M8 11h6"],
  zoomOut: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3", "M8 11h6"],
  maximize: [
    "M8 3H5a2 2 0 0 0-2 2v3",
    "M21 8V5a2 2 0 0 0-2-2h-3",
    "M3 16v3a2 2 0 0 0 2 2h3",
    "M16 21h3a2 2 0 0 0 2-2v-3",
  ],
  mic: ["M12 19v3", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"],
};

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Any CSS length — the replica passes `calc(var(--u) * n)`. */
  size: string;
  /** Stroke width in the icon's own 24-unit box. */
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size, weight = 2, color = "currentColor", style }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/**
 * The drafting spinner.
 *
 * The product spins a `Loader2` with a CSS animation, which this directory
 * cannot have — a CSS animation runs on the wall clock, and a film renders
 * frame 900 before frame 12. `turn` (0..1) comes from the caller and is derived
 * from `t`, so the ring is at the same angle in every render of the same frame.
 */
export function Spinner({
  size,
  turn,
  color = "currentColor",
}: {
  size: string;
  turn: number;
  color?: string;
}): JSX.Element {
  const deg = ((Number.isFinite(turn) ? turn : 0) % 1) * 360;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      style={{ display: "block", flexShrink: 0, transform: `rotate(${deg.toFixed(2)}deg)` }}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

/**
 * The pointer.
 *
 * Drawn rather than borrowed: a real cursor is an OS bitmap that a screenshot
 * catches and a film cannot, so every product demo that wants one draws it. Two
 * passes — a white outline under a near-black body — so it reads on the ivory
 * page, on the white sheet and over a rendering.
 */
export function CursorArrow({ size, color = "#1c1917" }: { size: string; color?: string }): JSX.Element {
  const d = "M5.5 2.5 L5.5 20.6 L10.3 15.9 L13.3 21.9 L16.6 20.3 L13.6 14.4 L20.1 14.4 Z";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="#ffffff" stroke="#ffffff" strokeWidth={3.2} strokeLinejoin="round" />
      <path d={d} fill={color} stroke={color} strokeWidth={0.6} strokeLinejoin="round" />
    </svg>
  );
}
