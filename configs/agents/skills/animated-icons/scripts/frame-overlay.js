const NAMES = ["search", "dashboard"];
const SVG_SELECTOR = "svg:has([data-icon-part])";
const HOST_SELECTOR = "button, a[href], label, [role='button']";
const CELL_PX = 120;

document.getElementById("icon-frame-overlay")?.remove();
const overlay = document.createElement("div");
overlay.id = "icon-frame-overlay";
overlay.style.cssText =
  "position:fixed;inset:0;z-index:99999;background:#151515;color:#f2f2f2;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:170px;padding:16px;gap:8px;align-content:start;font:12px sans-serif";

window.__anims = [];
const svgs = [...document.querySelectorAll(SVG_SELECTOR)];
svgs.forEach((svg, i) => {
  const host = svg.closest(HOST_SELECTOR);
  host.dispatchEvent(new PointerEvent("pointerenter"));
  const animations = svg.getAnimations({ subtree: true });
  animations.forEach((animation) => {
    animation.pause();
    window.__anims.push([animation, animation.effect.getComputedTiming().endTime]);
  });
  const wrapper = svg.parentElement;
  wrapper.style.color = "#fff";
  svg.setAttribute("width", String(CELL_PX));
  svg.setAttribute("height", String(CELL_PX));
  const label = document.createElement("div");
  label.textContent = `${NAMES[i] ?? i} (${animations.length} animations)`;
  const cell = document.createElement("div");
  cell.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid #333;border-radius:8px;padding:8px";
  cell.append(label, wrapper);
  overlay.append(cell);
});
document.body.append(overlay);

window.__total = Math.max(...window.__anims.map(([, end]) => end));
window.__t = (ms) => window.__anims.forEach(([animation]) => (animation.currentTime = ms));
window.__t(0);
JSON.stringify({ icons: svgs.length, animations: window.__anims.length, totalMs: window.__total })
