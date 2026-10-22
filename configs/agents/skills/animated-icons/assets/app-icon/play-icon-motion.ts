import { cssTransform, EASINGS, resolvePose, type Track } from "./icon-motion";
import { ICONS, type IconName, type IconSpec } from "./icon-registry";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function webKeyframes(track: Track): Keyframe[] {
  return track.keyframes.map((keyframe) => {
    const pose = resolvePose(keyframe);
    return {
      offset: keyframe.at,
      transform: cssTransform(pose),
      opacity: pose.opacity,
      easing: EASINGS[keyframe.ease ?? track.ease],
    };
  });
}

/**
 * @name playIconMotion
 * @description Plays an icon's motion once with the Web Animations API. The
 * parts are always on screen and every track starts and ends on the resting
 * pose, so the icon never blanks or redraws. Parts marked `hiddenAtRest` are
 * shown only while the motion runs. Returns false when a run is already in
 * progress, the user prefers reduced motion, or the icon has nothing to play.
 *
 * @example
 * button.addEventListener("pointerenter", () => playIconMotion(svg, "search"));
 */
export function playIconMotion(svg: SVGSVGElement, icon: IconName): boolean {
  if (svg.dataset.iconPlaying === "true") return false;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  const spec: IconSpec = ICONS[icon];
  const animations = spec.motion.tracks.flatMap((track) => {
    const keyframes = webKeyframes(track);
    return track.parts.flatMap((part) =>
      [...svg.querySelectorAll<SVGElement>(`[data-icon-part="${part}"]`)].map((element) =>
        element.animate(keyframes, {
          duration: track.duration,
          delay: track.delay ?? 0,
          fill: "both",
        }),
      ),
    );
  });
  if (animations.length === 0) return false;
  const animatedParts = new Set(spec.motion.tracks.flatMap((track) => track.parts));
  const extras = [...svg.querySelectorAll<SVGElement>("[data-icon-extra]")].filter((extra) =>
    animatedParts.has(extra.querySelector<SVGElement>("[data-icon-part]")?.dataset.iconPart ?? ""),
  );
  svg.dataset.iconPlaying = "true";
  for (const extra of extras) extra.setAttribute("visibility", "visible");
  function settle() {
    for (const extra of extras) extra.setAttribute("visibility", "hidden");
    for (const animation of animations) animation.cancel();
    delete svg.dataset.iconPlaying;
  }
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(settle);
  return true;
}
