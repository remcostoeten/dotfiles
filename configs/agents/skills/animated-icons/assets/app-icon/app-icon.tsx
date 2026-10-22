import { useEffect, useId, useRef, type CSSProperties } from "react";
import { cx } from "@/shared/helpers/cx";
import type { IconPart } from "./icon-motion";
import { ICONS, type IconName, type IconSpec } from "./icon-registry";
import { playIconMotion } from "./play-icon-motion";

const HOVER_HOST_SELECTOR = "button, a[href], label, [role='button']";
const DEFAULT_VIEW_BOX = "0 0 24 24";
const DEFAULT_STROKE_WIDTH = 2;

type AppIconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

type PartNodeProps = {
  spec: IconSpec;
  part: IconPart;
  idPrefix: string;
};

type ClipDefProps = {
  id: string;
  d: string;
};

function maskId(idPrefix: string, partId: string, kind: "clip" | "window"): string {
  return `${idPrefix}-${partId}-${kind}`;
}

function originStyle(spec: IconSpec, partId: string): CSSProperties | undefined {
  const track = spec.motion.tracks.find((candidate) => candidate.parts.includes(partId));
  if (!track) return undefined;
  const [x, y] = track.origin;
  return { transformBox: "view-box", transformOrigin: `${x}px ${y}px` };
}

function ClipDef({ id, d }: ClipDefProps) {
  return (
    <clipPath id={id} clipPathUnits="userSpaceOnUse">
      <path d={d} />
    </clipPath>
  );
}

function PartNode({ spec, part, idPrefix }: PartNodeProps) {
  const children = spec.parts.filter((candidate) => candidate.within === part.id);
  let node = (
    <g data-icon-part={part.id} style={originStyle(spec, part.id)}>
      <path
        d={part.d}
        strokeWidth={part.strokeWidth}
        clipPath={part.clip ? `url(#${maskId(idPrefix, part.id, "clip")})` : undefined}
      />
      {children.map((child) => (
        <PartNode key={child.id} spec={spec} part={child} idPrefix={idPrefix} />
      ))}
    </g>
  );
  if (part.window) {
    node = <g clipPath={`url(#${maskId(idPrefix, part.id, "window")})`}>{node}</g>;
  }
  if (part.hiddenAtRest) {
    node = (
      <g data-icon-extra="" visibility="hidden">
        {node}
      </g>
    );
  }
  return node;
}

export function AppIcon({ name, size = 16, className }: AppIconProps) {
  const spec: IconSpec = ICONS[name];
  const svgRef = useRef<SVGSVGElement | null>(null);
  const idPrefix = `icon${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const filled = spec.paint === "fill";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const host = svg.closest(HOVER_HOST_SELECTOR) ?? svg.parentElement ?? svg;
    function play() {
      if (svg) playIconMotion(svg, name);
    }
    host.addEventListener("pointerenter", play);
    return () => host.removeEventListener("pointerenter", play);
  }, [name]);

  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center leading-none", className)}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={spec.viewBox ?? DEFAULT_VIEW_BOX}
        width={size}
        height={size}
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? undefined : (spec.strokeWidth ?? DEFAULT_STROKE_WIDTH)}
        strokeLinecap={filled ? undefined : "round"}
        strokeLinejoin={filled ? undefined : "round"}
        focusable="false"
        overflow="visible"
      >
        <defs>
          {spec.parts.flatMap((part) => [
            part.clip && (
              <ClipDef
                key={`${part.id}-clip`}
                id={maskId(idPrefix, part.id, "clip")}
                d={part.clip}
              />
            ),
            part.window && (
              <ClipDef
                key={`${part.id}-window`}
                id={maskId(idPrefix, part.id, "window")}
                d={part.window}
              />
            ),
          ])}
        </defs>
        {spec.parts
          .filter((part) => part.within === undefined)
          .map((part) => (
            <PartNode key={part.id} spec={spec} part={part} idPrefix={idPrefix} />
          ))}
      </svg>
    </span>
  );
}
