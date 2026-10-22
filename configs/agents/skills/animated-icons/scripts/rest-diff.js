const NAMES = ["search", "dashboard"];
const REFERENCE = {
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  dashboard:
    '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
};
const SVG_SELECTOR = "svg:has([data-icon-part])";
const PX = 96;

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PX}" height="${PX}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const raster = (svgString) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PX;
      canvas.height = PX;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, PX, PX).data);
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  });

const svgs = [...document.querySelectorAll(SVG_SELECTOR)];
const out = { icons: svgs.length };
for (let i = 0; i < Math.min(NAMES.length, svgs.length); i++) {
  const clone = svgs[i].cloneNode(true);
  clone.querySelectorAll("[data-icon-extra]").forEach((el) => el.remove());
  clone.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
  clone.setAttribute("width", String(PX));
  clone.setAttribute("height", String(PX));
  clone.setAttribute("stroke", "#ffffff");
  const mine = await raster(new XMLSerializer().serializeToString(clone));
  const ref = await raster(wrap(REFERENCE[NAMES[i]]));
  let maxAlphaDiff = 0;
  let pixelsOver8 = 0;
  for (let p = 3; p < mine.length; p += 4) {
    const diff = Math.abs(mine[p] - ref[p]);
    if (diff > maxAlphaDiff) maxAlphaDiff = diff;
    if (diff > 8) pixelsOver8++;
  }
  out[NAMES[i]] = { maxAlphaDiff, pixelsOver8 };
}
JSON.stringify(out)
