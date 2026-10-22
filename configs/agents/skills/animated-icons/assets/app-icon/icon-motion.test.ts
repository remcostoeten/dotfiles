import { describe, expect, it } from "vitest";
import { cssTransform, resolvePose } from "./icon-motion";
import { ICONS, type IconSpec } from "./icon-registry";

const SPECS: [string, IconSpec][] = Object.entries<IconSpec>(ICONS);

function isRest(pose: ReturnType<typeof resolvePose>): boolean {
  return (
    pose.x === 0 &&
    pose.y === 0 &&
    pose.rotate === 0 &&
    pose.scaleX === 1 &&
    pose.scaleY === 1 &&
    pose.opacity === 1
  );
}

describe("resolvePose", () => {
  it("fills omitted fields with the identity", () => {
    expect(resolvePose({ scale: 0.8, y: 2 })).toEqual({
      x: 0,
      y: 2,
      rotate: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      opacity: 1,
    });
  });

  it("lets an axis override the uniform scale", () => {
    expect(resolvePose({ scale: 2, scaleY: 0.5 })).toMatchObject({ scaleX: 2, scaleY: 0.5 });
  });
});

describe("cssTransform", () => {
  it("orders translate, rotate and scale", () => {
    expect(cssTransform(resolvePose({ x: 1, rotate: -10, scale: 0.8 }))).toBe(
      "translate(1px, 0px) rotate(-10deg) scale(0.8, 0.8)",
    );
  });
});

describe.each(SPECS)("%s icon", (_name, spec) => {
  const partIds = spec.parts.map((part) => part.id);

  it("has unique part ids", () => {
    expect(new Set(partIds).size).toBe(partIds.length);
  });

  it("nests parts only inside parts that exist", () => {
    for (const part of spec.parts) {
      if (part.within !== undefined) expect(partIds).toContain(part.within);
    }
  });

  it("animates only parts that exist", () => {
    for (const track of spec.motion.tracks) {
      for (const part of track.parts) expect(partIds).toContain(part);
    }
  });

  it("runs every track from offset 0 to 1 in ascending order", () => {
    for (const track of spec.motion.tracks) {
      const offsets = track.keyframes.map((keyframe) => keyframe.at);
      expect(offsets[0]).toBe(0);
      expect(offsets[offsets.length - 1]).toBe(1);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    }
  });

  it("starts and ends every visible part on its resting pose", () => {
    const hidden = new Set(spec.parts.filter((part) => part.hiddenAtRest).map((part) => part.id));
    for (const track of spec.motion.tracks) {
      if (track.parts.some((part) => hidden.has(part))) continue;
      const first = resolvePose(track.keyframes[0]!);
      const last = resolvePose(track.keyframes[track.keyframes.length - 1]!);
      expect(isRest(first)).toBe(true);
      expect(isRest(last)).toBe(true);
    }
  });

  it("never fades a visible part", () => {
    const hidden = new Set(spec.parts.filter((part) => part.hiddenAtRest).map((part) => part.id));
    for (const track of spec.motion.tracks) {
      if (track.parts.some((part) => hidden.has(part))) continue;
      for (const keyframe of track.keyframes) expect(resolvePose(keyframe).opacity).toBe(1);
    }
  });

  it("hides a part at rest only when a window contains it and a track moves it", () => {
    for (const part of spec.parts.filter((candidate) => candidate.hiddenAtRest)) {
      const tracks = spec.motion.tracks.filter((track) => track.parts.includes(part.id));
      expect(tracks.length).toBeGreaterThan(0);
      expect(part.window).toBeDefined();
    }
  });
});
