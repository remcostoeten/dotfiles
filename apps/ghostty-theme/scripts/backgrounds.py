import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

W, H = 3840, 2160
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
U, V = xx / W, yy / H


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def noise(seed, cells, octaves=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cw = max(2, int(cells * 2**o))
        ch = max(2, int(cw * H / W))
        grid = rng.random((ch, cw)).astype(np.float32)
        img = Image.fromarray(grid, mode="F").resize((W, H), Image.BICUBIC)
        out += np.asarray(img) * amp
        total += amp
        amp *= 0.5
    return out / total


def grain(img, seed, strength=0.018):
    rng = np.random.default_rng(seed)
    return img + (rng.standard_normal((H, W, 1)).astype(np.float32) * strength)


def vignette(img, strength=0.45):
    d = np.sqrt(((U - 0.5) * 1.6) ** 2 + (V - 0.5) ** 2)
    return img * (1 - strength * np.clip(d, 0, 1)[..., None] ** 1.8)


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    pos = np.linspace(0, 1, len(stops))
    cols = np.stack([hexc(s) for s in stops])
    return np.stack([np.interp(t, pos, cols[:, c]) for c in range(3)], -1).astype(np.float32)


def blobs(base, points, sharp=2.2):
    img = np.broadcast_to(hexc(base), (H, W, 3)).copy()
    for x, y, r, col in points:
        d = np.sqrt(((U - x) * W / H) ** 2 + (V - y) ** 2) / r
        a = np.exp(-(d**sharp))[..., None]
        img = img * (1 - a) + hexc(col) * a
    return img


def save(name, img):
    arr = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(arr).save(OUT / f"{name}.png", compress_level=6)
    print(name)


def mesh(name, base, points, seed):
    warp = noise(seed, 3, 3) - 0.5
    img = blobs(base, [(x + 0.0, y, r, c) for x, y, r, c in points])
    shifted = np.roll(img, int(warp.mean() * 50), axis=1)
    save(name, vignette(grain(shifted, seed), 0.35))


def contours(name, stops, line, seed, bands=26):
    n = noise(seed, 2.5, 5)
    bg = ramp(V * 0.7 + n * 0.3, stops)
    field = n * bands
    gy, gx = np.gradient(field)
    slope = np.sqrt(gx**2 + gy**2) + 1e-6
    f = field % 1.0
    lines = np.clip(1.4 - np.abs(f - 0.5) / slope, 0, 1)
    major = ((np.floor(n * bands) % 5) == 0).astype(np.float32)
    a = (lines * (0.35 + 0.45 * major))[..., None]
    save(name, vignette(grain(bg * (1 - a) + hexc(line) * a, seed, 0.012)))


def dither(name, stops, seed):
    bayer = np.array(
        [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], np.float32
    ) / 16
    px = 6
    hh, ww = H // px, W // px
    n = np.asarray(Image.fromarray(noise(seed, 2, 3)).resize((ww, hh)))
    v, u = np.mgrid[0:hh, 0:ww]
    t = np.clip(v / hh * 0.85 + (n - 0.5) * 0.6 + 0.05, 0, 1)
    levels = len(stops) - 1
    s = t * levels
    idx = np.floor(s + bayer[v % 4, u % 4]).clip(0, levels).astype(int)
    pal = np.stack([hexc(c) for c in stops])
    small = pal[idx]
    img = np.asarray(
        Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.NEAREST)
    ).astype(np.float32) / 255
    save(name, vignette(img, 0.3))


def halftone(name, bg, dot, seed, cell=28):
    n = noise(seed, 1.8, 3)
    cx = (xx % cell) - cell / 2
    cy = (yy % cell) - cell / 2
    gx = (np.floor(xx / cell) * cell + cell / 2) / W
    gy = (np.floor(yy / cell) * cell + cell / 2) / H
    t = np.clip(gx * 0.55 + (1 - gy) * 0.25 + (n - 0.5) * 0.9, 0, 1) ** 1.6
    r = t * cell * 0.48
    a = np.clip(r - np.sqrt(cx**2 + cy**2) + 0.5, 0, 1)[..., None]
    base = ramp(V, bg)
    save(name, vignette(base * (1 - a) + hexc(dot) * a * 0.85 + base * a * 0.15, 0.3))


def dunes(name, sky, layers, seed, sun=None):
    img = ramp(V / 0.75, sky)
    if sun:
        x, y, r, col = sun
        d = np.sqrt(((U - x) * W / H) ** 2 + (V - y) ** 2)
        glow = np.exp(-(d / (r * 3)) ** 2)[..., None] * 0.35
        disc = np.clip((r - d) * 400, 0, 1)[..., None]
        img = img * (1 - glow) + hexc(col) * glow
        img = img * (1 - disc) + hexc(col) * disc
    rng = np.random.default_rng(seed)
    for i, col in enumerate(layers):
        base = 0.52 + i * (0.42 / len(layers))
        wave = np.zeros(W, np.float32)
        x = np.arange(W) / W
        for k in range(1, 6):
            wave += np.sin(x * np.pi * (k * 1.3 + rng.random()) + rng.random() * 6) * (0.05 / k)
        edge = base + wave
        a = np.clip((V - edge[None, :]) * H / 2.5, 0, 1)[..., None]
        shade = 1 - np.clip(V - edge[None, :], 0, 0.4)[..., None] * 0.6
        img = img * (1 - a) + hexc(col) * shade * a
    save(name, grain(img, seed, 0.014))


def rings(name, bg, ink, seed, centers):
    base = ramp(V, bg)
    a = np.zeros((H, W), np.float32)
    for x, y, freq in centers:
        d = np.sqrt(((U - x) * W / H) ** 2 + (V - y) ** 2)
        a += (np.cos(d * freq) * 0.5 + 0.5) ** 12
    a = np.clip(a / len(centers), 0, 1) * 0.5
    save(name, vignette(grain(base * (1 - a[..., None]) + hexc(ink) * a[..., None], seed, 0.01)))


def nebula(name, stops, seed, stars=2200):
    n = noise(seed, 1.5, 6)
    m = noise(seed + 1, 2.5, 5)
    t = np.clip((n - 0.3) * 2.6, 0, 1) ** 1.2
    img = ramp(t * (0.6 + 0.4 * m), stops)
    rng = np.random.default_rng(seed)
    star = np.zeros((H, W), np.float32)
    ys = rng.integers(0, H, stars)
    xs = rng.integers(0, W, stars)
    star[ys, xs] = rng.random(stars) ** 3
    star = Image.fromarray((star * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
    star = np.asarray(star).astype(np.float32) / 255 * 9
    save(name, vignette(grain(img + np.clip(star, 0, 1)[..., None] * 0.9, seed, 0.012)))


def glass(name, base, points, seed, stripe=64):
    img = blobs(base, points, 2.0)
    offs = (np.sin(xx / stripe * np.pi * 2) * 0.5 + 0.5) * 40
    sy = np.clip(yy + offs, 0, H - 1).astype(int)
    sx = np.clip(xx + offs * 0.4, 0, W - 1).astype(int)
    refr = img[sy, sx]
    edge = (np.abs(((xx % stripe) / stripe) - 0.5) * 2) ** 18
    refr = refr + edge[..., None] * 0.05
    save(name, vignette(grain(refr, seed, 0.016), 0.3))


def grid_glow(name, base, line, glow, seed):
    img = blobs(base, [(0.5, 1.25, 0.6, glow)], 1.6)
    step = 96
    gx = np.minimum(xx % step, step - xx % step)
    gy = np.minimum(yy % step, step - yy % step)
    g = np.clip(1.2 - np.minimum(gx, gy), 0, 1)
    dots = np.clip(3.2 - np.sqrt(gx**2 + gy**2), 0, 1)
    fade = np.clip(V * 1.2, 0, 1)
    a = ((g * 0.22 + dots * 0.6) * (0.35 + 0.65 * fade))[..., None]
    save(name, grain(img * (1 - a) + hexc(line) * a, seed, 0.012))


jobs = {
    "mesh-peach-orchid": lambda: mesh("mesh-peach-orchid", "#1b1426", [(0.15, 0.2, 0.55, "#ff9e7a"), (0.75, 0.15, 0.6, "#b469d6"), (0.55, 0.85, 0.7, "#3a2a6b"), (0.95, 0.7, 0.45, "#ff6f91")], 11),
    "mesh-lagoon": lambda: mesh("mesh-lagoon", "#071a22", [(0.2, 0.8, 0.6, "#0f6e6e"), (0.8, 0.2, 0.55, "#2d5bd1"), (0.5, 0.45, 0.4, "#43c6ac"), (0.05, 0.05, 0.4, "#13294b")], 12),
    "mesh-citrus-dusk": lambda: mesh("mesh-citrus-dusk", "#1a1020", [(0.1, 0.9, 0.6, "#f7b733"), (0.6, 0.95, 0.5, "#fc4a1a"), (0.85, 0.2, 0.6, "#4b2c69"), (0.35, 0.3, 0.45, "#7a2e5c")], 13),
    "topo-sand": lambda: contours("topo-sand", ["#2a2420", "#3b3029", "#4a3a2e"], "#d9b38c", 21),
    "topo-arctic": lambda: contours("topo-arctic", ["#0d1b2a", "#1b2a3d", "#24364d"], "#8fd3ff", 22),
    "topo-moss": lambda: contours("topo-moss", ["#101a14", "#18261d", "#1f3326"], "#9fd38a", 23, 34),
    "dither-sunset": lambda: dither("dither-sunset", ["#1a1033", "#3d1e5c", "#8a2f6e", "#d9536f", "#f6a65a"], 31),
    "dither-gameboy": lambda: dither("dither-gameboy", ["#0b130b", "#142416", "#23402a", "#3f6a2e", "#8bac0f"], 32),
    "halftone-coral": lambda: halftone("halftone-coral", ["#16121f", "#1d1726"], "#ff7a6b", 41),
    "halftone-cyan": lambda: halftone("halftone-cyan", ["#0b1220", "#101a2d"], "#4fd6e8", 42, 22),
    "dunes-apricot": lambda: dunes("dunes-apricot", ["#2b1b3d", "#7a3b5e", "#e98a6b"], ["#5a2d4a", "#43213d", "#2e1830", "#1c1020"], 51, (0.68, 0.42, 0.07, "#ffd3a1")),
    "dunes-glacier": lambda: dunes("dunes-glacier", ["#0b1626", "#1d3a5c", "#6fa3c7"], ["#2a4a6b", "#1e3854", "#14273d", "#0b1626"], 52, (0.3, 0.38, 0.05, "#e8f4ff")),
    "dunes-matcha": lambda: dunes("dunes-matcha", ["#141a12", "#2c3b25", "#a5b98a"], ["#4d6141", "#3a4c31", "#283624", "#182016"], 53, (0.8, 0.35, 0.06, "#f2efd9")),
    "rings-ink": lambda: rings("rings-ink", ["#121218", "#191925"], "#a59cff", 61, [(0.2, 0.3, 90), (0.85, 0.75, 70)]),
    "rings-amber": lambda: rings("rings-amber", ["#17120c", "#1f170f"], "#ffb347", 62, [(0.5, 1.1, 110), (0.1, -0.2, 80), (1.0, 0.2, 95)]),
    "nebula-violet": lambda: nebula("nebula-violet", ["#07060f", "#1d1438", "#5b2a86", "#c86fc9"], 71),
    "nebula-teal": lambda: nebula("nebula-teal", ["#030b0f", "#0a2a33", "#16697a", "#7fe0c8"], 72),
    "glass-berry": lambda: glass("glass-berry", "#140d1c", [(0.25, 0.35, 0.35, "#e0457b"), (0.7, 0.6, 0.4, "#6a3fd1"), (0.5, 0.1, 0.3, "#ff9f6e")], 81),
    "glass-mint": lambda: glass("glass-mint", "#0a1515", [(0.3, 0.6, 0.4, "#2bc4a0"), (0.75, 0.3, 0.35, "#3a7bd5"), (0.9, 0.9, 0.3, "#c8f08f")], 82, 80),
    "grid-horizon": lambda: grid_glow("grid-horizon", "#0e0b18", "#c9a7ff", "#b8336a", 91),
    "grid-terminal": lambda: grid_glow("grid-terminal", "#08100c", "#6dffb0", "#1f8f5a", 92),
}

only = sys.argv[2:] or list(jobs)
for key in only:
    jobs[key]()
