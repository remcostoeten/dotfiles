export type Pose = {
  x?: number;
  y?: number;
  rotate?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
};

export type ResolvedPose = Required<Omit<Pose, "scale">>;

export const EASINGS = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)",
  inout: "cubic-bezier(0.65, 0, 0.35, 1)",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export type EasingToken = keyof typeof EASINGS;

export type PoseKeyframe = Pose & {
  at: number;
  ease?: EasingToken;
};

export type Track = {
  parts: readonly string[];
  duration: number;
  delay?: number;
  ease: EasingToken;
  origin: readonly [number, number];
  keyframes: readonly PoseKeyframe[];
};

export type IconMotion = {
  tracks: readonly Track[];
};

export type IconPart = {
  id: string;
  d: string;
  within?: string;
  clip?: string;
  window?: string;
  strokeWidth?: number;
  hiddenAtRest?: true;
};

/**
 * @name resolvePose
 * @description Fills in the identity for every field a keyframe leaves out, so
 * a keyframe that only names `y` still describes a complete pose.
 *
 * @example
 * resolvePose({ scale: 0.8 }); // { x: 0, y: 0, rotate: 0, scaleX: 0.8, scaleY: 0.8, opacity: 1 }
 */
export function resolvePose(pose: Pose): ResolvedPose {
  return {
    x: pose.x ?? 0,
    y: pose.y ?? 0,
    rotate: pose.rotate ?? 0,
    scaleX: pose.scaleX ?? pose.scale ?? 1,
    scaleY: pose.scaleY ?? pose.scale ?? 1,
    opacity: pose.opacity ?? 1,
  };
}

/**
 * @name cssTransform
 * @description Writes a pose as a CSS `transform`, in the order the motion data
 * is designed in: translate, rotate, scale. The origin is set separately on the
 * element.
 *
 * @example
 * cssTransform(resolvePose({ y: -1.4 }));
 * // "translate(0px, -1.4px) rotate(0deg) scale(1, 1)"
 */
export function cssTransform(pose: ResolvedPose): string {
  return [
    `translate(${pose.x}px, ${pose.y}px)`,
    `rotate(${pose.rotate}deg)`,
    `scale(${pose.scaleX}, ${pose.scaleY})`,
  ].join(" ");
}
