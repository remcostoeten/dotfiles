import { useEffect, useRef, useState } from "react";
import { specRows, type SystemInfo } from "./lib/api";

// Cinematic launch sequence: a system-scan boot reveal that streams the real
// machine specs, then lifts away to expose the app. All movement is CSS-driven
// (off the main thread); JS only sequences phase changes and handles skip.
type Phase = "scan" | "ready" | "leaving";

// Timeline (ms). Lines stream from LINES_START, staggered by STAGGER.
const LINES_START = 700;
const STAGGER = 60;
const LINE_DUR = 340;
const READY_GAP = 260; // after last line settles -> "SYSTEM READY"
const LEAVE_GAP = 760; // after last line settles -> begin exit
const EXIT_DUR = 560; // matches the .intro-leaving transition

export function Intro({ info, onDone }: { info: SystemInfo | null; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("scan");
  const started = useRef(false);
  const leaving = useRef(false);
  const done = useRef(false);
  const timers = useRef<number[]>([]);

  const rows = info ? specRows(info) : [];

  function finalize() {
    if (done.current) return;
    done.current = true;
    onDone();
  }

  function leave() {
    if (leaving.current) return;
    leaving.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("leaving");
    timers.current.push(window.setTimeout(finalize, EXIT_DUR));
  }

  // Start the timed sequence once the real specs are available.
  useEffect(() => {
    if (!info || started.current) return;
    started.current = true;
    const settled = LINES_START + Math.max(0, rows.length - 1) * STAGGER + LINE_DUR;
    timers.current.push(window.setTimeout(() => setPhase("ready"), settled + READY_GAP));
    timers.current.push(window.setTimeout(leave, settled + LEAVE_GAP));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Any key skips straight to the exit.
  useEffect(() => {
    const onKey = () => leave();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settled = phase === "ready" || phase === "leaving";

  return (
    <div
      className={`intro ${phase === "leaving" ? "intro-leaving" : ""}`}
      onClick={leave}
      role="presentation"
    >
      <div className="intro-inner">
        <div className="intro-word">
          <span className="intro-logo">DOTFILES</span>
          <span className="intro-logo intro-logo-dim">STUDIO</span>
        </div>

        <div className="intro-scanrow">
          <span className="intro-scan-label">{settled ? "SYSTEM READY" : "SCANNING SYSTEM"}</span>
          <span className={`intro-cursor ${settled ? "ok" : ""}`} />
        </div>

        <div className="intro-specs">
          {rows.map(([label, value], i) => (
            <div
              className={`intro-spec ${i % 2 === 0 ? "intro-spec-left" : "intro-spec-right"}`}
              key={label}
              style={{ animationDelay: `${LINES_START + i * STAGGER}ms` }}
            >
              <span className="intro-spec-label">{label}</span>
              <span className="intro-leader" />
              <span className="intro-spec-value">{value || "unknown"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="intro-scanline" />
      <div className="intro-hint">press any key to skip</div>
    </div>
  );
}
