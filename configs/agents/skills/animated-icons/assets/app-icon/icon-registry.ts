import type { IconMotion, IconPart, Track } from "./icon-motion";

export type IconSpec = {
  viewBox?: string;
  paint?: "stroke" | "fill";
  strokeWidth?: number;
  parts: readonly IconPart[];
  motion: IconMotion;
};

function pop(part: string, origin: readonly [number, number], delay: number, tilt: number): Track {
  return {
    parts: [part],
    duration: 800,
    delay,
    ease: "out",
    origin,
    keyframes: [
      { at: 0 },
      { at: 0.22, scale: 0.8, rotate: tilt },
      { at: 0.55, scale: 1.12 },
      { at: 1 },
    ],
  };
}

function tile(part: string, x: number, y: number, delay: number): Track {
  return {
    parts: [part],
    duration: 760,
    delay,
    ease: "spring",
    origin: [12, 12],
    keyframes: [{ at: 0 }, { at: 0.4, x, y }, { at: 1 }],
  };
}

function slide(part: string, delay: number): Track {
  return {
    parts: [part],
    duration: 820,
    delay,
    ease: "spring",
    origin: [17, 12],
    keyframes: [{ at: 0 }, { at: 0.2 }, { at: 0.5, x: 1.6 }, { at: 1 }],
  };
}

function bar(part: string, x: number, delay: number): Track {
  return {
    parts: [part],
    duration: 800,
    delay,
    ease: "out",
    origin: [x, 17],
    keyframes: [{ at: 0 }, { at: 0.3, scaleY: 0.45 }, { at: 0.65, scaleY: 1.1 }, { at: 1 }],
  };
}

function lift(part: string, y: number): Track {
  return {
    parts: [part],
    duration: 760,
    ease: "spring",
    origin: [12, 21],
    keyframes: [{ at: 0 }, { at: 0.4, y }, { at: 1 }],
  };
}

export const ICONS = {
  dashboard: {
    parts: [
      { id: "tl", d: "M4 3H9a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" },
      { id: "tr", d: "M15 3H20a1 1 0 0 1 1 1V7a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" },
      {
        id: "br",
        d: "M15 12H20a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V13a1 1 0 0 1 1-1z",
      },
      { id: "bl", d: "M4 16H9a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V17a1 1 0 0 1 1-1z" },
    ],
    motion: {
      tracks: [
        tile("tl", -1.2, -1.2, 0),
        tile("tr", 1.2, -1.2, 40),
        tile("br", 1.2, 1.2, 80),
        tile("bl", -1.2, 1.2, 120),
      ],
    },
  },
  share: {
    parts: [
      { id: "source", d: "M3 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z" },
      { id: "top", d: "M15 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0z" },
      { id: "bottom", d: "M15 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0z" },
      { id: "linkBottom", d: "M8.59 13.51L15.42 17.49" },
      { id: "linkTop", d: "M15.41 6.51L8.59 10.49" },
    ],
    motion: {
      tracks: [
        pop("source", [6, 12], 0, 0),
        pop("top", [18, 5], 110, 0),
        pop("bottom", [18, 19], 160, 0),
      ],
    },
  },
  tasks: {
    parts: [
      { id: "tickTop", d: "m3 7 2 2 4-4" },
      { id: "tickBottom", d: "m3 17 2 2 4-4" },
      { id: "lineTop", d: "M13 5h8" },
      { id: "lineMiddle", d: "M13 12h8" },
      { id: "lineBottom", d: "M13 19h8" },
    ],
    motion: {
      tracks: [
        pop("tickTop", [5, 9], 0, -10),
        pop("tickBottom", [5, 19], 220, -10),
        slide("lineTop", 0),
        slide("lineMiddle", 110),
        slide("lineBottom", 220),
      ],
    },
  },
  mail: {
    parts: [
      { id: "body", d: "M4 4H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
      { id: "flap", d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" },
    ],
    motion: {
      tracks: [
        {
          parts: ["body"],
          duration: 760,
          ease: "out",
          origin: [12, 12],
          keyframes: [{ at: 0 }, { at: 0.35, y: -1.4 }, { at: 0.7, y: 0.3 }, { at: 1 }],
        },
        {
          parts: ["flap"],
          duration: 760,
          ease: "out",
          origin: [12, 7],
          keyframes: [
            { at: 0 },
            { at: 0.35, y: -1.4, scaleY: 0.55 },
            { at: 0.7, y: 0.3, scaleY: 1.1 },
            { at: 1 },
          ],
        },
      ],
    },
  },
  building: {
    parts: [
      { id: "tower", d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" },
      {
        id: "wing",
        d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
      },
      { id: "door", d: "M14 21v-3a2 2 0 0 0-4 0v3" },
      { id: "windowTop", d: "M10 8h4" },
      { id: "windowBottom", d: "M10 12h4" },
    ],
    motion: {
      tracks: [
        {
          parts: ["tower"],
          duration: 760,
          ease: "spring",
          origin: [12, 21],
          keyframes: [{ at: 0 }, { at: 0.4, scaleY: 1.07 }, { at: 1 }],
        },
        lift("windowTop", -0.9),
        lift("windowBottom", -0.6),
        {
          parts: ["door"],
          duration: 760,
          delay: 60,
          ease: "spring",
          origin: [12, 21],
          keyframes: [{ at: 0 }, { at: 0.4, scaleY: 1.25 }, { at: 1 }],
        },
      ],
    },
  },
  chart: {
    parts: [
      { id: "axes", d: "M3 3v16a2 2 0 0 0 2 2h16" },
      { id: "barShort", d: "M8 17v-3" },
      { id: "barTall", d: "M13 17V5" },
      { id: "barMid", d: "M18 17V9" },
    ],
    motion: {
      tracks: [bar("barShort", 8, 0), bar("barTall", 13, 80), bar("barMid", 18, 160)],
    },
  },
  search: {
    parts: [
      { id: "lens", d: "M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0z" },
      { id: "handle", d: "m21 21-4.34-4.34" },
      {
        id: "glint",
        d: "M6.3 9.29A5 5 0 0 1 9.29 6.3",
        within: "lens",
        window: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0z",
        strokeWidth: 1.5,
        hiddenAtRest: true,
      },
    ],
    motion: {
      tracks: [
        {
          parts: ["lens", "handle"],
          duration: 900,
          ease: "inout",
          origin: [11, 11],
          keyframes: [
            { at: 0 },
            { at: 0.25, x: -1.6, y: -1.2 },
            { at: 0.5, x: 1.4, y: -1.6 },
            { at: 0.75, x: 0.8, y: 0.8 },
            { at: 1 },
          ],
        },
        {
          parts: ["glint"],
          duration: 900,
          ease: "inout",
          origin: [11, 11],
          keyframes: [
            { at: 0, x: -9, y: -9 },
            { at: 0.3, x: -9, y: -9 },
            { at: 1, x: 9, y: 9 },
          ],
        },
      ],
    },
  },
  switcher: {
    parts: [
      { id: "up", d: "m7 9 5-5 5 5" },
      { id: "down", d: "m7 15 5 5 5-5" },
    ],
    motion: {
      tracks: [
        {
          parts: ["up"],
          duration: 600,
          ease: "out",
          origin: [12, 6],
          keyframes: [{ at: 0 }, { at: 0.4, y: -1.6 }, { at: 1 }],
        },
        {
          parts: ["down"],
          duration: 600,
          ease: "out",
          origin: [12, 18],
          keyframes: [{ at: 0 }, { at: 0.4, y: 1.6 }, { at: 1 }],
        },
      ],
    },
  },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;
