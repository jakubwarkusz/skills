#!/usr/bin/env node
// audit_icons.mjs: measure a set of icons and flag the ones that don't match the rest. Node 18+ and Playwright.
//
//   node audit_icons.mjs <icons.html | folder of .svg | icon.svg> [--grid 16] [--out <dir>] [--exceptions <file>] [--root <dir>]
//
// Input: an HTML page where each icon is an <svg> inside an element with data-icon="Name" (any <svg> on the page
// when none has data-icon), a folder of .svg files, or one .svg file. Each icon is serialised on its own and drawn
// to a canvas, so ids repeated across icons don't bleed into each other in the measurements.
//
// Everything is measured in grid units (one unit is one pixel when the icon is shown at its grid size).
// Per icon it prints the ink box, the centre of the box and of the weight, ink coverage, enclosed gaps that survive
// at 2x and 1x, the thinnest gap between two edges, and the stroke widths for ink and for cut-outs (black strokes
// inside a mask), multiplied by any transform above them. It flags:
//   stroke, cut   a width that isn't the set's (or the spec's)
//                 cut also: a glyph that is what the icon shows (the cuts of a filled icon are one line icon of the
//                 set, scaled by half or more, in its middle) and is cut thinner than the stroke
//   weight        an icon drawn as outlines whose measured line thickness isn't the set's stroke
//   ends          caps or joins that differ from the set's
//   centre        a box centre more than 0.25 off
//   size          a box more than an eighth of the grid from the median of its kind (filled or line)
//   counters      enclosed gaps that close or break apart at the grid size on a 2x screen
//   gap           two edges closer than half a unit (one pixel on a 2x screen), or closer than the spec's gap
//   thin          a sliver of ink thinner than half a unit
//   cap           a cut with a round cap that ends on an edge: the cap's curve leaves two rounded corners of ink
//   speck         a loose part thinner than the stroke: usually the leftover of a cut
//   ring          a gap between two parts that isn't one width all the way (the ring around a badge)
//   clip          ink that touches the edge of the viewBox
//   colour        paint that doesn't follow currentColor
//   id            an id that another icon on the page also uses
//   grid          a viewBox that isn't the set's grid, isn't square or doesn't start at 0 0
//   pool          a line icon with a blob of ink over twice the stroke thick: strokes meeting at a narrow angle,
//                 or a ring too small to keep its hole
//   family        icons named as turns of one drawing (ArrowUp, ArrowLeft) that aren't the same drawing turned
//   layer         an icon named as another plus a badge or a slash (FilePlus, BellOff) whose base isn't that
//                 other icon left where it is. A base that is kept is judged for centre on its own.
//   variant       icons named as variants of one drawing (FileOutline, FileFill) whose boxes differ
//   glyph         an icon named after a line icon of the set (FileCheck after Check, UserPlus after Plus) in which
//                 no stroke is that icon's path scaled by one factor
//   scale         drawings of one icon for different sizes (Lock12, Lock16, Lock24) that fill their grids differently
//   twin          two icons that are the same drawing under different names
//
// icons.audit.json beside the input (or --exceptions) may hold:
//   "spec": { "16": { "stroke": 1.5, "line": 1.75, "cut": 1.25, "gap": 1 }, "12": { "stroke": 1 }, "24": { "stroke": 2 } }
//     the numbers each grid is held to, instead of the majority. "line" is the stroke of icons that are only
//     lines, for sets where those are drawn heavier than the strokes of filled icons. Every grid named here is a
//     drawing size of the set and is measured on its own; an icon on any other grid is flagged.
//   "exceptions": [{ "icon", "check", "value", "reason" }]
//     flags accepted on purpose (centre, cut, stroke, size, grid, colour, family, layer, twin, glyph). An exception only covers the
//     value it names: when the icon changes, the flag returns, and one that matches nothing is reported as stale.
//
// Writes <out>/report.json, <out>/sheet.png (each icon large on its grid, as 1x pixels, and at 1x and 2x size;
// flagged names orange, accepted blue; sheet-2.png and so on for big sets) and <out>/rows.png (the icons in a
// toolbar and beside 13 px labels, light and dark). Exit 1 when anything is flagged, stale or invalid, 2 when the
// audit could not run.
// Playwright comes from --root, the current folder, the folder of this script or the global install. The browser
// is PW_CHROMIUM when set, else Playwright's own download, else the newest Chromium in the Playwright cache, else
// an installed Chrome.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { homedir, platform } from "node:os";

const usage = "usage: node audit_icons.mjs <icons.html | svg-folder | icon.svg> [--grid 16] [--out <dir>] [--exceptions <file>] [--root <dir>]";
const args = process.argv.slice(2);
if (!args.length || args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(args.length ? 0 : 2);
}
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const input = resolve(args[0]);
if (!existsSync(input)) { console.error(`${input} does not exist.\n${usage}`); process.exit(2); }
const gridArg = opt("--grid") ? Number(opt("--grid")) : null;
if (gridArg !== null && !(gridArg > 0)) { console.error(`--grid takes a number, got ${opt("--grid")}`); process.exit(2); }
const out = resolve(opt("--out") || "icon-audit");

function cachedChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]
    .filter((r) => r && existsSync(r));
  const names = new Set(["Chromium", "Google Chrome for Testing", "chrome", "chrome-headless-shell", "headless_shell"]);
  for (const r of roots) {
    const builds = readdirSync(r).filter((d) => /^(chromium|chromium_headless_shell)-\d+$/.test(d)).sort().reverse();
    for (const b of builds) {
      const stack = [[join(r, b), 0]];
      while (stack.length) {
        const [d, depth] = stack.pop();
        let entries = [];
        try { entries = readdirSync(d); } catch { continue; }
        for (const e of entries) {
          const p = join(d, e);
          let s; try { s = statSync(p); } catch { continue; }
          if (s.isFile() && names.has(e) && (s.mode & 0o111)) return p;
          if (s.isDirectory() && depth < 6) stack.push([p, depth + 1]);
        }
      }
    }
  }
  return null;
}

const systemChrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];

function findPlaywright() {
  const places = [opt("--root"), process.cwd(), dirname(fileURLToPath(import.meta.url))].filter(Boolean).map((p) => resolve(p));
  try { places.push(dirname(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim())); } catch {}
  for (const p of places) {
    for (const name of ["playwright", "playwright-core"]) {
      try { return createRequire(join(p, "noop.js"))(name); } catch {}
    }
  }
  return null;
}

async function launch() {
  const pw = findPlaywright();
  if (!pw) {
    console.error([
      "The audit needs Playwright and did not find it in --root, the current folder, the skill folder or the global install.",
      "Install it where the icons live, then run the audit again from that folder:",
      "  npm i -D playwright && npx playwright install chromium",
      "Or point at a folder that already has it: --root <folder with node_modules/playwright>.",
    ].join("\n"));
    process.exit(2);
  }
  const cached = cachedChromium();
  const attempts = [
    process.env.PW_CHROMIUM && ["PW_CHROMIUM", { executablePath: process.env.PW_CHROMIUM }],
    ["Playwright's own browser", {}],
    cached && ["the Playwright cache", { executablePath: cached }],
    ["Chrome (channel)", { channel: "chrome" }],
    ...systemChrome.filter((exe) => existsSync(exe)).map((exe) => [exe, { executablePath: exe }]),
  ].filter(Boolean);
  const tried = [];
  let missingLibraries = false;
  for (const [label, options] of attempts) {
    try { return await pw.chromium.launch(options); }
    catch (error) {
      const message = String(error.message);
      if (/shared librar|missing dependencies|install-deps/i.test(message)) missingLibraries = true;
      tried.push(`  ${label}: ${message.split("\n").find((line) => line.trim()).slice(0, 140)}`);
    }
  }
  const fix = missingLibraries && platform() === "linux"
    ? ["A browser is installed but the system libraries it needs are not. On Linux run:", "  npx playwright install-deps chromium   (uses sudo; on a machine without it, install Chrome or Chromium from the package manager)"]
    : ["Download Playwright's browser:", "  npx playwright install chromium"];
  console.error([
    "The audit needs a Chromium browser and none would start. Tried:",
    ...tried,
    ...fix,
    `Or set PW_CHROMIUM to a Chrome or Chromium executable, for example ${platform() === "darwin" ? '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"' : "/usr/bin/google-chrome"}.`,
  ].join("\n"));
  process.exit(2);
}

function pageFor(path) {
  if (statSync(path).isDirectory()) {
    const files = readdirSync(path).filter((f) => extname(f) === ".svg").sort();
    if (!files.length) { console.error(`no .svg files in ${path}`); process.exit(2); }
    return { html: files.map((f) => `<div data-icon="${basename(f, ".svg")}">${readFileSync(join(path, f), "utf8")}</div>`).join("") };
  }
  if (extname(path) === ".svg") return { html: `<div data-icon="${basename(path, ".svg")}">${readFileSync(path, "utf8")}</div>` };
  return { url: pathToFileURL(path).href };
}

// The exceptions file is read before measuring: its spec says which grids are drawing sizes of the set.
const base = statSync(input).isDirectory() ? input : dirname(input);
// A page made by render_icons.mjs names the folder of the icons it was rendered from; the file may live there.
const beside = () => {
  const here = join(base, "icons.audit.json");
  if (existsSync(here) || !statSync(input).isFile() || !/\.html?$/i.test(input)) return here;
  const named = readFileSync(input, "utf8").match(/<meta name="icons-source" content="([^"]*)"/);
  const there = named && join(named[1].replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code)), "icons.audit.json");
  return there && existsSync(there) ? there : here;
};
const exceptionsPath = opt("--exceptions") ? resolve(opt("--exceptions")) : beside();
const exceptions = [];
const invalid = [];
const spec = {};
const excusable = ["centre", "cut", "stroke", "size", "grid", "colour", "family", "layer", "twin", "glyph"];
if (opt("--exceptions") && !existsSync(exceptionsPath)) invalid.push(`${exceptionsPath} does not exist`);
if (existsSync(exceptionsPath)) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(exceptionsPath, "utf8")); } catch (error) { invalid.push(`${exceptionsPath} is not valid JSON: ${error.message}`); }
  for (const [size, numbers] of Object.entries(parsed?.spec ?? {})) {
    const known = ["stroke", "line", "cut", "gap"];
    if (!(Number(size) > 0) || !numbers || typeof numbers !== "object") invalid.push(`spec "${size}": the key is a grid size and the value an object, like "16": { "stroke": 1.5 }`);
    else if (Object.entries(numbers).some(([k, v]) => !known.includes(k) || !(typeof v === "number" && v > 0))) invalid.push(`spec "${size}": takes numbers for ${known.join(", ")}`);
    else spec[Number(size)] = numbers;
  }
  for (const [index, entry] of (parsed?.exceptions ?? []).entries()) {
    const where = `exception ${index + 1}${entry?.icon ? ` (${entry.icon})` : ""}`;
    const shape = entry?.check === "centre" ? "[dx, dy]" : entry?.check === "colour" ? "colour string" : entry?.check === "twin" ? "name of the other icon" : "number";
    const valueFits = entry?.check === "centre" ? Array.isArray(entry.value) && entry.value.length === 2 && entry.value.every((v) => typeof v === "number")
      : entry?.check === "colour" || entry?.check === "twin" ? typeof entry.value === "string" : typeof entry?.value === "number";
    if (!entry || typeof entry.icon !== "string") invalid.push(`${where}: needs "icon"`);
    else if (!excusable.includes(entry.check)) invalid.push(`${where}: "check" is one of ${excusable.join(", ")}; anything else is fixed in the drawing`);
    else if (typeof entry.reason !== "string" || entry.reason.trim().length < 12) invalid.push(`${where}: needs a "reason" that says why it can't follow the set`);
    else if (!valueFits) invalid.push(`${where}: "value" is the measured ${shape} from the audit`);
    else exceptions.push({ ...entry, used: false });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const source = pageFor(input);
if (source.url) await page.goto(source.url);
else await page.setContent(`<!doctype html><body>${source.html}</body>`);

const measured = await page.evaluate(async ({ gridArg, drawingSizes }) => {
  const marked = [...document.querySelectorAll("[data-icon]")];
  const list = (marked.length
    ? marked.map((el) => ({ name: el.getAttribute("data-icon"), svg: el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg") }))
    : [...document.querySelectorAll("svg")].map((svg, i) => ({ name: svg.getAttribute("aria-label") || `icon-${i + 1}`, svg }))
  ).filter((entry) => entry.svg);

  const boxOf = (svg) => (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null);
  const widths = new Map();
  for (const { svg } of list) { const vb = boxOf(svg); if (vb) widths.set(vb.width, (widths.get(vb.width) || 0) + 1); }
  // Without --grid the main grid is the most common one, among the grids the spec names when it names any: a set
  // drawn on a grid the spec doesn't have is a set on the wrong grid, not a new main grid.
  const ranked = [...widths.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
  const grid = gridArg || (drawingSizes.length ? ranked.find((w) => drawingSizes.includes(w)) ?? drawingSizes[0] : ranked[0] ?? 16);

  const idCount = new Map();
  for (const { svg } of list) for (const id of new Set([...svg.querySelectorAll("[id]")].map((el) => el.id))) idCount.set(id, (idCount.get(id) || 0) + 1);

  // Exact Euclidean distance (in pixels) from every pixel to the nearest pixel where feature is set.
  const distance = (feature, W, H) => {
    const INF = 1e20, n = Math.max(W, H);
    const d = new Float64Array(W * H), f = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let i = 0; i < W * H; i++) d[i] = feature[i] ? 0 : INF;
    const pass = (start, stride, len) => {
      for (let i = 0; i < len; i++) f[i] = d[start + i * stride];
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[start + q * stride] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    };
    for (let x = 0; x < W; x++) pass(x, W, H);
    for (let y = 0; y < H; y++) pass(y * W, 1, W);
    const result = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) result[i] = Math.sqrt(d[i]);
    return result;
  };
  const draw = (img, W, H) => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H).data;
  };
  const decode = async (markup) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await img.decode();
    return img;
  };
  const black = /rgb\(0, 0, 0\)|#000/;
  const hex = (n) => Math.round(n).toString(16).padStart(2, "0");

  const result = [];
  for (const { name, svg } of list) {
    const vb = boxOf(svg) || { x: 0, y: 0, width: grid, height: grid };
    const own = Math.max(vb.width, vb.height);
    const viewBox = svg.getAttribute("viewBox") || "";
    // The thinnest and the thickest a stroke gets under the transforms above it. They are one number unless
    // something is stretched (scale(2 .5)), and then the stroke has two widths and neither is the set's.
    const scaleOf = (el) => {
      let m = new DOMMatrixReadOnly();
      for (let n = el; n && n !== svg; n = n.parentElement) {
        const t = getComputedStyle(n).transform;
        if (t && t !== "none") m = new DOMMatrixReadOnly(t).multiply(m);
      }
      const sum = m.a * m.a + m.b * m.b + m.c * m.c + m.d * m.d, det = Math.abs(m.a * m.d - m.b * m.c);
      const spread = Math.sqrt(Math.max(0, sum * sum - 4 * det * det));
      return [Math.sqrt((sum - spread) / 2), Math.sqrt((sum + spread) / 2)];
    };
    const strokes = { ink: new Set(), cut: new Set(), knock: new Set() };
    const ends = new Set();
    // The geometry of an element as written, to recognise a knockout: a black stroke with the same shape drawn
    // again in ink after it. Its width is the ink's stroke plus a ring on each side, so it is not a cut.
    const written = (el) => [el.tagName, ...["d", "points", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "transform"].map((a) => (el.getAttribute(a) || "").replace(/\s+/g, " ").trim())].join("|");
    const drawnShapes = [...svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon")];
    // Centre lines of every stroked subpath, in grid units, to compare a glyph inside one icon with the set's own.
    const lines = [];
    // For each of them, the width it is cut at, or null when it is ink.
    const lineCuts = [];
    const toFrame = (el) => {
      let m = new DOMMatrixReadOnly();
      for (let n = el; n && n !== svg; n = n.parentElement) {
        const t = getComputedStyle(n).transform;
        if (t && t !== "none") m = new DOMMatrixReadOnly(t).multiply(m);
      }
      return m;
    };
    // Both ends of every open subpath, with the way the line is heading there: where a round cap sits.
    const capEnds = [];
    const endsOf = (el, r) => {
      const tag = el.tagName.toLowerCase();
      if (tag !== "path" && tag !== "line" && tag !== "polyline") return [];
      const total = el.getTotalLength();
      if (!(total > 0)) return [];
      const bounds = [0], closed = [];
      if (tag === "path") {
        const pieces = (el.getAttribute("d") || "").split(/(?=[Mm])/).filter((piece) => piece.trim());
        const probe = el.cloneNode(false);
        let prefix = "";
        for (const piece of pieces) { prefix += piece; probe.setAttribute("d", prefix); bounds.push(probe.getTotalLength()); closed.push(/[Zz]\s*$/.test(piece.trim())); }
      } else { bounds.push(total); closed.push(false); }
      const m = toFrame(el);
      const at = (length) => { const p = el.getPointAtLength(length); return new DOMPoint(p.x, p.y).matrixTransform(m); };
      const found = [];
      for (let b = 0; b + 1 < bounds.length; b++) {
        const from = bounds[b], to = bounds[b + 1], step = Math.min(0.2, (to - from) / 4);
        if (closed[b] || !(to - from > 0.01)) continue;
        for (const [tip, back] of [[at(from + 0.001), at(from + step)], [at(to - 0.001), at(to - step)]]) {
          const length = Math.hypot(tip.x - back.x, tip.y - back.y);
          if (length > 0) found.push({ x: tip.x, y: tip.y, dx: (tip.x - back.x) / length, dy: (tip.y - back.y) / length, r });
        }
      }
      return found;
    };
    const trace = (el) => {
      const total = el.getTotalLength();
      if (!(total > 0)) return;
      const bounds = [0];
      if (el.tagName.toLowerCase() === "path") {
        const pieces = (el.getAttribute("d") || "").split(/(?=[Mm])/).filter((piece) => piece.trim());
        const probe = el.cloneNode(false);
        let prefix = "";
        for (const piece of pieces.slice(0, -1)) { prefix += piece; probe.setAttribute("d", prefix); bounds.push(probe.getTotalLength()); }
      }
      bounds.push(total);
      const m = toFrame(el);
      for (let b = 0; b + 1 < bounds.length; b++) {
        const from = bounds[b], to = bounds[b + 1];
        if (!(to - from > 0.01)) continue;
        const points = [];
        for (let k = 0; k <= 24; k++) {
          const at = el.getPointAtLength(from + ((to - from) * k) / 24);
          const p = new DOMPoint(at.x, at.y).matrixTransform(m);
          points.push([p.x - vb.x, p.y - vb.y]);
        }
        lines.push(points);
      }
    };
    let filled = false;
    // The filled shapes that are ink: a single circle is a disc that may hold a glyph as the icon's subject.
    const solids = [];
    for (const el of svg.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon")) {
      const cs = getComputedStyle(el);
      const masked = el.closest("mask");
      if (!masked && el.closest("defs, symbol, clipPath")) continue;
      const paints = cs.fill && cs.fill !== "none" && Number(cs.fillOpacity) > 0;
      const cutout = masked && black.test(cs.fill);
      const maskedFill = !masked && el.hasAttribute("mask");
      const tag = el.tagName.toLowerCase();
      const open = tag === "line" || tag === "polyline";
      if (paints && !cutout && !maskedFill && !open) {
        filled = true;
        // A circle, or an ellipse with equal radii, that no transform stretches into an oval.
        const [narrow, wide] = scaleOf(el);
        const round = (tag === "circle" || (tag === "ellipse" && el.rx.baseVal.value === el.ry.baseVal.value)) && Math.abs(wide - narrow) < 0.001;
        solids.push(round ? "circle" : tag === "circle" ? "ellipse" : tag);
      }
      if (!cs.stroke || cs.stroke === "none") continue;
      const [thinnest, thickest] = scaleOf(el).map((k) => Math.round(parseFloat(cs.strokeWidth) * k * 100) / 100);
      if (!thickest) continue;
      const shape = written(el);
      const knockout = masked && black.test(cs.stroke) && drawnShapes.slice(drawnShapes.indexOf(el) + 1).some((later) => {
        if (later.closest("mask") !== masked || written(later) !== shape) return false;
        const style = getComputedStyle(later);
        return style.stroke && style.stroke !== "none" && !black.test(style.stroke);
      });
      const widths = knockout ? strokes.knock : masked && black.test(cs.stroke) ? strokes.cut : strokes.ink;
      widths.add(thinnest);
      widths.add(thickest);
      if (!knockout) {
        trace(el);
        // A cut stretched by a transform has no one width: -1, so it is never taken for a glyph cut at the stroke.
        while (lineCuts.length < lines.length) lineCuts.push(masked && black.test(cs.stroke) ? (thinnest === thickest ? thickest : -1) : null);
      }
      if (!knockout && masked && black.test(cs.stroke) && cs.strokeLinecap === "round") capEnds.push(...endsOf(el, thickest / 2));
      const d = tag === "path" ? el.getAttribute("d") || "" : "";
      const openPath = open || (tag === "path" && d.split(/(?=[Mm])/).some((sub) => sub.trim() && !/[Zz]\s*$/.test(sub.trim())));
      if (openPath) ends.add(`${cs.strokeLinecap} caps`);
      if (tag === "path" || tag === "polyline" || tag === "polygon") ends.add(`${cs.strokeLinejoin} joins`);
    }
    const sharedIds = [...new Set([...svg.querySelectorAll("[id]")].map((el) => el.id))].filter((id) => idCount.get(id) > 1);

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.removeAttribute("class");
    // Inline paint (stroke, fill) stays; what would resize, move, hide or recolour the picture, or paint behind it, goes.
    for (const property of ["width", "height", "min-width", "min-height", "max-width", "max-height", "display", "position", "transform", "margin", "opacity", "visibility", "color", "inset", "top", "left", "right", "bottom", "background", "background-color", "background-image", "border", "outline", "padding", "box-shadow", "filter"]) clone.style.removeProperty(property);
    const PX = Math.max(8, Math.round(640 / own));
    const W = Math.round(vb.width * PX), H = Math.round(vb.height * PX);
    clone.setAttribute("width", W);
    clone.setAttribute("height", H);
    clone.setAttribute("color", "#000");
    const markup = new XMLSerializer().serializeToString(clone);
    let img, tinted;
    try {
      img = await decode(markup);
      clone.setAttribute("color", "#0b5cff");
      tinted = await decode(new XMLSerializer().serializeToString(clone));
    } catch { result.push({ name, own, viewBox, error: "could not render" }); continue; }

    const data = draw(img, W, H);
    const N = W * H;
    const ink = new Uint8Array(N), paper = new Uint8Array(N);
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, count = 0, mass = 0, mx = 0, my = 0, edge = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      mass += a; mx += a * (x + 0.5); my += a * (y + 0.5);
      if (a > 40) {
        ink[y * W + x] = 1; count++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      } else paper[y * W + x] = 1;
    }
    if (x1 < 0) { result.push({ name, own, viewBox, error: "nothing drawn" }); continue; }
    const inkAt = (x, y) => { const px = Math.floor((x - vb.x) * PX), py = Math.floor((y - vb.y) * PX); return px >= 0 && py >= 0 && px < W && py < H && ink[py * W + px] === 1; };
    const caps = capEnds.filter(({ x, y, dx, dy, r }) => { const reach = r + 0.3; return inkAt(x - dy * reach, y + dx * reach) && inkAt(x + dy * reach, y - dx * reach) && !inkAt(x + dx * reach, y + dy * reach); }).length;

    // Paint that ignores currentColor keeps its colour when the icon is drawn in another one.
    const small = Math.min(W, 200), smallH = Math.round((small * H) / W);
    const tint = draw(tinted, small, smallH);
    let painted = 0, stuck = 0, sr = 0, sg = 0, sb = 0;
    for (let i = 0; i < small * smallH; i++) {
      if (tint[i * 4 + 3] < 60) continue;
      painted++;
      const r = tint[i * 4], g = tint[i * 4 + 1], b = tint[i * 4 + 2];
      if (Math.abs(r - 11) + Math.abs(g - 92) + Math.abs(b - 255) > 90) { stuck++; sr += r; sg += g; sb += b; }
    }
    const fixedColour = painted && stuck / painted > 0.01 ? `#${hex(sr / stuck)}${hex(sg / stuck)}${hex(sb / stuck)}` : null;

    const toInk = distance(ink, W, H);
    const toPaper = distance(paper, W, H);
    // A pixel midway between two facing edges has a distance field that is flat across it: the slope drops
    // below 0.26 when the nearest edges on either side are at least 150 degrees apart.
    const flat = (field, i) => {
      const gx = (field[i + 2] - field[i - 2]) / 4, gy = (field[i + 2 * W] - field[i - 2 * W]) / 4;
      return gx * gx + gy * gy < 0.0676;
    };
    const gaps = [], bodies = [];
    const histogram = new Map();
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (ink[i]) {
        if (!flat(toPaper, i)) continue;
        const t = (2 * toPaper[i] - 0.5) / PX;
        bodies.push(t);
        if (t <= own / 5) { const bin = Math.round(t * 20); histogram.set(bin, (histogram.get(bin) || 0) + 1); }
      } else if (toInk[i] < 2 * PX && flat(toInk, i)) gaps.push((2 * toInk[i] - 0.5) / PX);
    }
    gaps.sort((a, b) => a - b); bodies.sort((a, b) => a - b);
    const nth = (values, n) => (values.length > n ? values[n] : null);
    const gap = nth(gaps, Math.round(PX / 4));
    const thin = nth(bodies, Math.round(PX * 0.75));
    const peak = [...histogram.entries()].sort((a, b) => b[1] - a[1])[0];
    let weight = null;
    if (peak && peak[1] > PX * 1.5 && peak[1] > bodies.length * 0.25) {
      let total = 0, sum = 0;
      for (const bin of [peak[0] - 1, peak[0], peak[0] + 1]) { const c = histogram.get(bin) || 0; total += c; sum += c * bin; }
      weight = sum / total / 20;
    }

    // Separate parts of ink, largest first.
    const label = new Int32Array(N);
    const parts = [];
    for (let start = 0; start < N; start++) {
      if (!ink[start] || label[start]) continue;
      const id = parts.length + 1, stack = [start];
      label[start] = id;
      let area = 0, deepest = 0;
      while (stack.length) {
        const k = stack.pop(); area++;
        if (toPaper[k] > deepest) deepest = toPaper[k];
        const x = k % W, y = (k - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (ink[n] && !label[n]) { label[n] = id; stack.push(n); }
        }
      }
      parts.push({ id, area: area / (PX * PX), thickness: (2 * deepest - 0.5) / PX });
    }
    parts.sort((a, b) => b.area - a.area);

    // Where two parts run side by side, the width of the gap between them along its middle.
    const rings = [];
    const candidates = parts.length === 2 ? parts.slice(0, 1) : parts.length > 2 ? parts.slice(0, 8) : [];
    for (const part of candidates) {
      const self = new Uint8Array(N), rest = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (ink[i]) (label[i] === part.id ? self : rest)[i] = 1;
      const a = distance(self, W, H), b = distance(rest, W, H);
      const middle = new Float32Array(N);
      const seeds = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (ink[i] || Math.abs(a[i] - b[i]) > 1 || a[i] > 1.5 * PX) continue;
        const ax = a[i + 1] - a[i - 1], ay = a[i + W] - a[i - W], bx = b[i + 1] - b[i - 1], by = b[i + W] - b[i - W];
        const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
        if (cos <= -0.966) { middle[i] = (a[i] + b[i] - 1) / PX; seeds.push(i); }
      }
      // Each unbroken stretch of the middle line is one gap, judged on its own.
      const taken = new Uint8Array(N);
      for (const seed of seeds) {
        if (taken[seed]) continue;
        const found = [], stack = [seed];
        taken[seed] = 1;
        while (stack.length) {
          const k = stack.pop(); found.push(middle[k]);
          const x = k % W, y = (k - x) / W;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const n = ny * W + nx;
            if (middle[n] && !taken[n]) { taken[n] = 1; stack.push(n); }
          }
        }
        if (found.length < PX / 2) continue;
        found.sort((p, q) => p - q);
        const at = (share) => found[Math.min(found.length - 1, Math.floor(found.length * share))];
        rings.push({ length: found.length / 1.5 / PX, min: at(0.05), max: at(0.95) });
      }
    }

    const display = drawingSizes.includes(own) ? own : grid;
    const holes = (side, minShare) => {
      const w = Math.max(1, Math.round((side * vb.width) / own)), h = Math.max(1, Math.round((side * vb.height) / own));
      const pixels = side === own * PX ? data : draw(img, w, h);
      const seen = new Uint8Array(w * h);
      const inked = (k) => pixels[k * 4 + 3] > 127;
      const fill = (start) => {
        const stack = [start]; seen[start] = 1; let area = 0, open = false;
        while (stack.length) {
          const k = stack.pop(); area++;
          const x = k % w, y = (k - x) / w;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
          for (const n of [x > 0 && k - 1, x < w - 1 && k + 1, y > 0 && k - w, y < h - 1 && k + w]) {
            if (n !== false && !seen[n] && !inked(n)) { seen[n] = 1; stack.push(n); }
          }
        }
        return { area, open };
      };
      let total = 0;
      for (let k = 0; k < w * h; k++) {
        if (seen[k] || inked(k)) continue;
        const { area, open } = fill(k);
        if (!open && area >= Math.max(1, minShare * w * h)) total++;
      }
      return total;
    };

    // A coarse picture of the ink, to tell whether two icons are one drawing turned or mirrored.
    let picture = null;
    if (vb.width === vb.height) {
      const side = 96, bits = draw(img, side, side);
      picture = "";
      for (let i = 0; i < side * side; i++) picture += bits[i * 4 + 3] > 127 ? "1" : "0";
    }

    result.push({
      name, markup, own, display, viewBox,
      square: vb.width === vb.height, origin: vb.x === 0 && vb.y === 0,
      w: (x1 - x0 + 1) / PX, h: (y1 - y0 + 1) / PX,
      cx: (x0 + x1 + 1) / 2 / PX, cy: (y0 + y1 + 1) / 2 / PX,
      mx: mx / mass / PX, my: my / mass / PX,
      midX: vb.width / 2, midY: vb.height / 2,
      ink: count / N, filled, edge, fixedColour, sharedIds, gap, thin, weight, rings, caps,
      parts: parts.map(({ area, thickness }) => ({ area, thickness })),
      counters: { full: holes(own * PX, 0.004), retina: holes(display * 2, 0), screen: holes(display, 0) },
      strokes: { ink: [...strokes.ink].sort((p, q) => p - q), cut: [...strokes.cut].sort((p, q) => p - q), knock: [...strokes.knock].sort((p, q) => p - q) },
      ends: [...ends].sort(), picture, lines, lineCuts, disc: solids.length === 1 && solids[0] === "circle",
    });
  }
  return { grid, icons: result };
}, { gridArg, drawingSizes: Object.keys(spec).map(Number) });

const { grid, icons } = measured;
if (!icons.length) { console.error(`no <svg> found in ${input}`); await browser.close(); process.exit(2); }

const tally = (values) => {
  const count = new Map();
  for (const v of values) count.set(v, (count.get(v) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
};
const mode = (values) => {
  const counts = tally(values);
  return counts.length > 1 && counts[0][1] === counts[1][1] ? undefined : counts[0]?.[0];
};
const spread = (values) => tally(values).map(([v, n]) => `${v} (${n})`).join(", ");
const median = (values) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const round = (n) => Math.round(n * 100) / 100;

// Names that repeat (one icon drawn for several grids) get the grid appended, so exceptions can tell them apart.
const repeated = new Set(tally(icons.map((i) => i.name)).filter(([, n]) => n > 1).map(([name]) => name));
for (const i of icons) if (repeated.has(i.name)) i.name = `${i.name}@${i.own}`;

// An icon is measured on its own grid when that grid is a drawing size of the set (the main grid, or one the spec
// names). On any other grid it is scaled to the main grid, the way it shows next to the others, and flagged.
const drawingSizes = new Set([grid, ...Object.keys(spec).map(Number)]);
for (const i of icons) {
  i.flags = [];
  if (i.error) { i.flags.push({ check: "error", text: i.error }); continue; }
  const guest = exceptions.some((e) => e.check === "grid" && e.icon === i.name && e.value === i.own);
  i.grid = drawingSizes.has(i.own) && !guest ? i.own : grid;
  i.foreign = i.grid !== i.own;
  const k = i.grid / i.own;
  for (const key of ["w", "h", "cx", "cy", "mx", "my", "midX", "midY", "gap", "thin", "weight"]) if (i[key] !== null) i[key] *= k;
  for (const part of i.parts) { part.area *= k * k; part.thickness *= k; }
  for (const ring of i.rings) { ring.length *= k; ring.min *= k; ring.max *= k; }
  i.strokes = { ink: i.strokes.ink.map((w) => round(w * k)), cut: i.strokes.cut.map((w) => round(w * k)), knock: i.strokes.knock.map((w) => round(w * k)) };
  i.kind = i.filled ? "filled" : "line";
}
const drawn = icons.filter((i) => !i.error);
// Centre lines brought to one box, so only their shape is compared.
const boxed = (lines) => {
  const points = lines.flat();
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), size = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const cx = (x0 + Math.max(...xs)) / 2, cy = (y0 + Math.max(...ys)) / 2;
  return points.map((p) => [(p[0] - cx) / size, (p[1] - cy) / size]);
};
const farFrom = (a, b) => a.reduce((sum, p) => sum + Math.min(...b.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))), 0) / a.length;
const spanOf = (lines) => {
  const points = lines.flat();
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { size: Math.max(x1 - x0, y1 - y0) || 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};
// A glyph that is the subject of its icon (the check in a success disc) is cut at the stroke, not at the thinner
// width of details: the ink is one disc, and its cuts are together one line icon of the set, scaled by half or
// more, in the middle. Found by shape, whatever either icon is called, and before the set's cut width is
// counted, so that these cuts don't pass for the width of details.
for (const i of drawn) {
  if (i.foreign || i.kind !== "filled" || !i.disc || !i.lines?.length) continue;
  const cuts = i.lines.filter((_, at) => i.lineCuts[at] !== null);
  const widths = [...new Set(i.lineCuts.filter((w) => w !== null))];
  if (!cuts.length || widths.length !== 1 || widths[0] < 0) continue;
  const got = boxed(cuts), mine = spanOf(cuts);
  if (Math.hypot(mine.cx - i.midX, mine.cy - i.midY) > 1) continue;
  for (const glyph of drawn) {
    if (glyph === i || glyph.foreign || glyph.grid !== i.grid || glyph.kind !== "line" || glyph.lines?.length !== cuts.length) continue;
    const want = boxed(glyph.lines);
    if ((farFrom(want, got) + farFrom(got, want)) / 2 > 0.005) continue;
    const factor = mine.size / spanOf(glyph.lines).size;
    if (factor < 0.5) continue;
    i.subject = { of: glyph.name, factor: Math.round(factor * 100) / 100, width: widths[0] };
    break;
  }
}
const sets = new Map();
for (const g of [...new Set(drawn.map((i) => i.grid))].sort((a, b) => a - b)) {
  const members = drawn.filter((i) => i.grid === g);
  const wanted = spec[g] || {};
  const inkAll = members.flatMap((i) => i.strokes.ink), cutAll = members.flatMap((i) => (i.subject ? i.strokes.cut.filter((w) => w !== i.subject.width) : i.strokes.cut));
  const set = {
    grid: g, count: members.length, kinds: { filled: members.filter((i) => i.kind === "filled").length, line: members.filter((i) => i.kind === "line").length },
    stroke: wanted.stroke ?? mode(inkAll), line: wanted.line, cut: wanted.cut ?? mode(cutAll), gap: wanted.gap ?? 0.5,
    fromSpec: { stroke: wanted.stroke !== undefined, cut: wanted.cut !== undefined, gap: wanted.gap !== undefined },
    caps: mode(members.flatMap((i) => i.ends.filter((e) => e.endsWith("caps")))),
    joins: mode(members.flatMap((i) => i.ends.filter((e) => e.endsWith("joins")))),
    size: {
      filled: median(members.filter((i) => i.kind === "filled").map((i) => Math.max(i.w, i.h))),
      line: median(members.filter((i) => i.kind === "line").map((i) => Math.max(i.w, i.h))),
    },
    disagree: [],
  };
  if (inkAll.length && set.stroke === undefined) set.disagree.push(`strokes disagree with no majority: ${spread(inkAll)}`);
  if (cutAll.length && set.cut === undefined) set.disagree.push(`cuts disagree with no majority: ${spread(cutAll)}`);
  // Icons drawn as outlines carry no stroke width, so their lines are measured instead.
  set.weight = set.stroke ?? (median(members.filter((i) => i.weight !== null && !i.strokes.ink.length).map((i) => round(i.weight))) || undefined);
  sets.set(g, set);
}

// The outline twin of a filled icon (MailOutline beside MailFill) keeps the set's stroke, not the heavier one for
// icons that are only lines: it has to fill the same box as its twin.
// Names are read as words whatever their case: MailOutline, mail-outline, mail_outline.
const variantWord = /^(outline|outlined|line|stroke|fill|filled|solid|duo|duotone)$/;
const nameWords = (i) => i.name.split(/[-_ .]+|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean).map((w) => w.toLowerCase());
const stemOf = (i) => `${i.grid}:${nameWords(i).filter((w) => !variantWord.test(w)).join("-")}`;
const isVariant = (i) => nameWords(i).some((w) => variantWord.test(w));
const filledStems = new Set(drawn.filter((i) => i.kind === "filled" && isVariant(i)).map(stemOf));
for (const i of drawn) {
  const set = sets.get(i.grid);
  const flag = (check, value, text) => i.flags.push({ check, value, text });
  if (!i.square || !i.origin) flag("grid", i.own, `viewBox "${i.viewBox}" is not a square starting at 0 0; keep the frame fixed and move the drawing`);
  else if (i.foreign) flag("grid", i.own, `drawn on a ${i.own} grid (set uses ${grid}); at the same size its lines scale by ${round(grid / i.own)}`);
  const lineOnly = i.kind === "line" && !(isVariant(i) && filledStems.has(stemOf(i)));
  const stroke = lineOnly && set.line !== undefined ? set.line : set.stroke;
  if (stroke !== undefined) for (const w of i.strokes.ink.filter((w) => w !== stroke)) flag("stroke", w, `stroke ${w} (${stroke === set.line ? "spec says lines are" : set.fromSpec.stroke ? "spec says" : "set uses"} ${stroke})`);
  if (set.cut !== undefined) for (const w of i.strokes.cut.filter((w) => w !== set.cut)) flag("cut", w, `cut ${w} (${set.fromSpec.cut ? "spec says" : "set uses"} ${set.cut})`);
  if (!i.foreign && !i.strokes.ink.length && i.weight !== null && set.weight !== undefined && Math.abs(i.weight - set.weight) > 0.15) flag("weight", round(i.weight), `lines measure ${round(i.weight)} thick (set uses ${set.weight})`);
  for (const end of i.ends) {
    const usual = end.endsWith("caps") ? set.caps : set.joins;
    if (usual !== undefined && end !== usual) flag("ends", end, `${end} (set uses ${usual})`);
  }
  const dx = round(i.cx - i.midX), dy = round(i.cy - i.midY);
  i.offset = [dx, dy];
  i.massOffset = [round(i.mx - i.midX), round(i.my - i.midY)];
  if (Math.abs(dx) > 0.25 || Math.abs(dy) > 0.25) flag("centre", [dx, dy], `off centre by ${dx.toFixed(2)}, ${dy.toFixed(2)}`);
  if (i.counters.retina !== i.counters.full) flag("counters", i.counters.retina, i.counters.retina < i.counters.full ? `${i.counters.full - i.counters.retina} of ${i.counters.full} enclosed gaps close at ${i.display} px on a 2x screen` : `an enclosed gap breaks into ${i.counters.retina} pieces at ${i.display} px on a 2x screen (${i.counters.full} at full size)`);
  const big = round(Math.max(i.w, i.h));
  // A median of one or two icons says nothing about the third.
  const smallByNature = /(^|[a-z0-9._-])(Chevron|Chevrons|Caret|Dot|Dots)(?![a-z])/.test(i.name) || /(^|[._-])(chevron|chevrons|caret|dot|dots)([._-]|$)/.test(i.name);
  if (set.kinds[i.kind] >= 3 && (smallByNature ? big - set.size[i.kind] : Math.abs(big - set.size[i.kind])) > i.grid / 8) flag("size", big, `size ${big.toFixed(2)} vs ${i.kind} median ${set.size[i.kind].toFixed(2)}`);
  if (i.gap !== null && i.gap < set.gap - 0.05) flag("gap", round(i.gap), `two edges are ${round(i.gap)} apart (${set.fromSpec.gap ? `spec says ${set.gap}` : "under half a unit closes on a 2x screen"}); widen the gap or join the parts`);
  if (i.caps) flag("cap", i.caps, `${i.caps === 1 ? "a round-capped cut ends" : `${i.caps} round-capped cuts end`} on an edge and ${i.caps === 1 ? "leaves" : "leave"} rounded corners of ink beside the opening; run the cut at least its own width past the edge, or end it inside the shape`);
  if (i.thin !== null && i.thin < 0.45) flag("thin", round(i.thin), `a sliver of ink ${round(i.thin)} thick; thicken it or cut it away`);
  const least = (set.weight ?? i.grid / 16) * 0.65;
  const specks = i.parts.filter((part) => part.thickness < least);
  if (specks.length) flag("speck", round(specks[0].thickness), `${specks.length > 1 ? `${specks.length} loose parts` : "a loose part"} ${round(specks[0].thickness)} thick, thinner than the stroke; usually what a cut left behind`);
  const uneven = i.rings.filter((ring) => ring.length >= 2 && ring.max - ring.min > 0.15).sort((a, b) => b.max - b.min - (a.max - a.min))[0];
  if (uneven) flag("ring", [round(uneven.min), round(uneven.max)], `the gap between two parts runs from ${round(uneven.min)} to ${round(uneven.max)}; a ring or a gap keeps one width`);
  const widest = Math.max(0, ...i.strokes.ink);
  const blob = i.kind === "line" && widest ? Math.max(...i.parts.map((part) => part.thickness)) : 0;
  if (blob > widest * 2) flag("pool", round(blob), `ink pools ${round(blob)} thick where strokes meet, over twice the ${widest} stroke; open the angle between them or enlarge the ring`);
  if (i.edge) flag("clip", 0, "ink touches the edge of the viewBox and is cut off there; move it inside the live area");
  if (i.fixedColour) flag("colour", i.fixedColour, `paint ${i.fixedColour} does not follow currentColor`);
  if (i.sharedIds.length) flag("id", i.sharedIds[0], `id "${i.sharedIds[0]}" is also used by another icon on the page; both will show the first one's drawing`);
}

// Families: icons whose names differ only by a direction should be one drawing, turned or mirrored.
const directions = /^(Up|Down|Left|Right|Top|Bottom|North|South|East|West|Back|Forward|Previous|Prev|Next|Undo|Redo)$/;
const vertical = /^(Up|Down|Top|Bottom|North|South)$/;
const turned = (picture, side, t) => {
  let outPicture = "";
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const m = side - 1;
    const [sx, sy] = [[x, y], [m - y, x], [m - x, m - y], [y, m - x], [m - x, y], [x, m - y], [y, x], [m - y, m - x]][t];
    outPicture += picture[sy * side + sx];
  }
  return outPicture;
};
const difference = (a, b) => {
  let differ = 0, inked = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] !== b[k]) differ++; if (a[k] === "1" || b[k] === "1") inked++; }
  return inked ? differ / inked : 0;
};
// The words of a name, without a size at its end: FilePlus, file-plus and file_plus_16 are all File + Plus.
const wordsOf = (name) => name.replace(/[-_@ ]?\d+(\.\d+)?(px)?$/, "").split(/(?=[A-Z])|[-_ ]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
const families = new Map();
for (const i of drawn) {
  if (!i.picture) continue;
  const words = wordsOf(i.name);
  const found = words.filter((w) => directions.test(w));
  if (!found.length || found.length > 2) continue;
  const shape = found.length === 1 ? "one" : vertical.test(found[0]) !== vertical.test(found[1]) ? "diagonal" : "both";
  const key = `${i.grid}:${shape}:${words.map((w) => (directions.test(w) ? "*" : w)).join("")}`;
  families.set(key, [...(families.get(key) || []), i]);
}
for (const members of families.values()) {
  if (members.length < 2) continue;
  const side = Math.sqrt(members[0].picture.length);
  const apart = (a, b) => Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((t) => difference(turned(a.picture, side, t), b.picture)));
  const alike = members.map((a) => members.filter((b) => b !== a && apart(a, b) <= 0.06).length);
  const model = members[alike.indexOf(Math.max(...alike))];
  for (const member of members) {
    if (member === model) continue;
    const off = apart(model, member);
    if (off > 0.06) member.flags.push({ check: "family", value: Math.round(off * 100), text: `not ${model.name} turned or mirrored: ${Math.round(off * 100)}% of the ink differs; draw one and turn it with a transform` });
  }
}

// Layers and variants.
const layerWords = /^(Plus|Add|Minus|Remove|Check|Done|X|Close|Cross|Badge|Dot|Unread|Alert|Warning|Error|Info|Question|Off|Slash|Lock|Locked|Star|Clock|Search|Edit|Settings|Cog|Gear|New|Sync|Ban|Dots|More|Heart|Key|Pin|User|Code|Text|Image)$/;
const variantWords = /^(Outline|Outlined|Line|Stroke|Fill|Filled|Solid|Duo|Duotone)$/;
// The outline of a picture: ink that touches the paper around the icon, not the paper inside it.
const outlineOf = (picture, side) => {
  const outside = new Uint8Array(side * side), stack = [];
  const visit = (k) => { if (picture[k] === "0" && !outside[k]) { outside[k] = 1; stack.push(k); } };
  for (let k = 0; k < side; k++) { visit(k); visit(side * (side - 1) + k); visit(k * side); visit(k * side + side - 1); }
  while (stack.length) {
    const k = stack.pop(), x = k % side, y = (k - x) / side;
    if (x > 0) visit(k - 1); if (x < side - 1) visit(k + 1); if (y > 0) visit(k - side); if (y < side - 1) visit(k + side);
  }
  const edge = new Uint8Array(side * side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const k = y * side + x;
    if (picture[k] !== "1") continue;
    if (x === 0 || y === 0 || x === side - 1 || y === side - 1 || outside[k - 1] || outside[k + 1] || outside[k - side] || outside[k + side]) edge[k] = 1;
  }
  return edge;
};
const named = new Map(drawn.filter((i) => i.picture).map((i) => [`${i.grid}:${wordsOf(i.name).join("")}`, i]));
for (const i of drawn) {
  if (!i.picture) continue;
  const words = wordsOf(i.name).filter((w) => !variantWords.test(w));
  let cut = words.length - 1;
  while (cut > 0 && layerWords.test(words[cut])) cut--;
  // The longest shorter name that is an icon of the set is the base: FileLockPlus sits on FileLock before File.
  let base = null;
  for (let length = words.length - 1; length > cut && !base; length--) base = named.get(`${i.grid}:${words.slice(0, length).join("")}`) || null;
  if (!base || base === i) continue;
  const side = Math.sqrt(i.picture.length), before = outlineOf(base.picture, side), after = outlineOf(i.picture, side);
  let total = 0, kept = 0;
  for (let k = 0; k < before.length; k++) if (before[k]) { total++; if (after[k]) kept++; }
  i.base = base.name;
  i.baseKept = total ? kept / total : 0;
  if (i.baseKept < 0.5) i.flags.push({ check: "layer", value: Math.round(i.baseKept * 100), text: `${Math.round(i.baseKept * 100)}% of ${base.name}'s outline is where ${base.name} has it; keep the base in place and lay the badge or slash over it` });
  // The base carries the centre: a badge hangs off one corner on purpose.
  else i.flags = i.flags.filter((flag) => flag.check !== "centre");
}
const variants = new Map();
for (const i of drawn) {
  const words = wordsOf(i.name);
  if (!words.some((w) => variantWords.test(w))) continue;
  const key = `${i.grid}:${words.filter((w) => !variantWords.test(w)).join("")}`;
  variants.set(key, [...(variants.get(key) || []), i]);
}
for (const members of variants.values()) {
  if (members.length < 2) continue;
  const apart = (a, b) => Math.max(...["w", "h", "cx", "cy"].map((key) => Math.abs(a[key] - b[key])));
  const alike = members.map((a) => members.filter((b) => b !== a && apart(a, b) <= 0.25).length);
  const model = members[alike.indexOf(Math.max(...alike))];
  for (const member of members) {
    // With two variants there is no telling which one moved, so both are named.
    const other = member === model ? (members.length === 2 ? members.find((m) => m !== model) : null) : model;
    if (!other || apart(member, other) <= 0.25) continue;
    member.flags.push({ check: "variant", value: round(apart(member, other)), text: `box ${member.w.toFixed(2)} x ${member.h.toFixed(2)} against ${other.name}'s ${other.w.toFixed(2)} x ${other.h.toFixed(2)}; build the variants from the same parts` });
  }
}

// A glyph inside another icon is the set's own glyph, scaled: the check in FileCheck is Check, the plus in
// UserPlus is Plus. Compared by centre lines, each brought to the same box, so only the shape counts.
const single = new Map(drawn.filter((i) => i.kind === "line" && i.lines?.length && wordsOf(i.name).length === 1).map((i) => [`${i.grid}:${wordsOf(i.name)[0]}`, i]));
for (const i of drawn) {
  const words = wordsOf(i.name);
  if (words.length < 2 || !i.lines?.length) continue;
  for (const word of new Set(words)) {
    const glyph = single.get(`${i.grid}:${word}`);
    if (!glyph || glyph === i || glyph.name === i.base) continue;
    const want = boxed(glyph.lines), count = glyph.lines.length;
    let best = Infinity;
    for (let at = 0; at + count <= i.lines.length; at++) {
      const got = boxed(i.lines.slice(at, at + count));
      best = Math.min(best, (farFrom(want, got) + farFrom(got, want)) / 2);
    }
    i.glyphs = [...(i.glyphs || []), { of: glyph.name, off: round(best * 100) }];
    if (best > 0.005) i.flags.push({ check: "glyph", value: round(best * 100), text: `no part of it is ${glyph.name} scaled: the nearest is ${round(best * 100)}% off ${glyph.name}'s shape; scale ${glyph.name}'s path by one factor instead of redrawing it` });
  }
}

// A subject cut thinner than the stroke is flagged, and one cut at the stroke is not a wrong cut width.
for (const i of drawn) {
  const set = sets.get(i.grid);
  if (!i.subject || set.stroke === undefined) continue;
  i.flags = i.flags.filter((flag) => !(flag.check === "cut" && flag.value === i.subject.width));
  if (i.subject.width !== set.stroke) i.flags.push({ check: "cut", value: i.subject.width, text: `the ${i.subject.of} cut out of it is what the icon shows (${i.subject.of} scaled by ${i.subject.factor}) and is cut at ${i.subject.width}; cut it at the stroke, ${set.stroke}, so it stays whole on a 1x screen` });
}

// Drawings of one icon for different sizes are the same object: each fills its grid about as much as the others.
const sized = new Map();
for (const i of drawn) {
  const key = wordsOf(i.name).join("");
  sized.set(key, [...(sized.get(key) || []), i]);
}
for (const members of sized.values()) {
  const grids = new Set(members.map((m) => m.grid));
  if (grids.size < 2 || grids.size !== members.length) continue;
  const model = members.reduce((a, b) => (sets.get(a.grid).count >= sets.get(b.grid).count ? a : b));
  for (const member of members) {
    if (member === model) continue;
    const off = Math.max(Math.abs(member.w / member.grid - model.w / model.grid), Math.abs(member.h / member.grid - model.h / model.grid));
    const stretch = Math.abs(member.w / member.h - model.w / model.h);
    if (off <= 0.1 && stretch > 0.12) member.flags.push({ check: "scale", value: round(stretch), text: `is ${member.w.toFixed(2)} by ${member.h.toFixed(2)}; ${model.name} is ${model.w.toFixed(2)} by ${model.h.toFixed(2)}, a different proportion. Keep the proportions when redrawing for a size` });
    if (off > 0.1) member.flags.push({ check: "scale", value: round(off), text: `fills ${Math.round((member.w / member.grid) * 100)}% x ${Math.round((member.h / member.grid) * 100)}% of its ${member.grid} grid; ${model.name} fills ${Math.round((model.w / model.grid) * 100)}% x ${Math.round((model.h / model.grid) * 100)}% of its ${model.grid}. Keep the proportions when redrawing for a size` });
  }
}
// The same drawing under two names.
for (let a = 0; a < drawn.length; a++) for (let b = a + 1; b < drawn.length; b++) {
  const one = drawn[a], two = drawn[b];
  if (!one.picture || !two.picture || one.grid !== two.grid || one.picture.length !== two.picture.length) continue;
  if (difference(one.picture, two.picture) > 0.005) continue;
  for (const [icon, other] of [[one, two], [two, one]]) icon.flags.push({ check: "twin", value: other.name, text: `the same drawing as ${other.name}; keep one, or accept it as an alias with the reason` });
}

const matches = (entry, flag) => {
  if (entry.check !== flag.check) return false;
  if (flag.check === "centre") return Math.abs(entry.value[0] - flag.value[0]) <= 0.1 && Math.abs(entry.value[1] - flag.value[1]) <= 0.1;
  if (flag.check === "size") return Math.abs(entry.value - flag.value) <= 0.25;
  if (flag.check === "family") return Math.abs(entry.value - flag.value) <= 3;
  if (flag.check === "twin") return entry.value === flag.value;
  if (flag.check === "glyph") return Math.abs(entry.value - flag.value) <= 1;
  if (flag.check === "layer") return Math.abs(entry.value - flag.value) <= 5;
  if (flag.check === "colour") return String(entry.value).toLowerCase() === String(flag.value).toLowerCase();
  return entry.value === flag.value;
};
for (const i of icons) {
  i.accepted = [];
  i.flags = i.flags.filter((flag) => {
    const entry = exceptions.find((e) => e.icon === i.name && matches(e, flag));
    if (!entry) return true;
    entry.used = true;
    // An optical centre is only a reason when the weight really sits nearer the middle than the box does.
    if (flag.check === "centre") {
      const worse = [0, 1].some((axis) => Math.abs(flag.value[axis]) > 0.25 && Math.abs(i.massOffset[axis]) >= Math.abs(flag.value[axis]));
      if (worse) { flag.text += `; the exception does not hold, its weight sits ${i.massOffset.map((v) => v.toFixed(2)).join(", ")} off, no nearer the middle than its box`; return true; }
    }
    i.accepted.push({ check: flag.check, text: flag.text, reason: entry.reason });
    return false;
  });
}
const stale = exceptions.filter((e) => !e.used);

const f = (n) => n.toFixed(2).padStart(5);
const width = Math.max(4, ...icons.map((i) => i.name.length));
const disagree = [...sets.values()].flatMap((set) => set.disagree.map((line) => (sets.size > 1 ? `grid ${set.grid}: ${line}` : line)));
if (existsSync(exceptionsPath)) console.log(`spec and exceptions from ${exceptionsPath}`);
for (const set of sets.values()) {
  const from = (key) => (set.fromSpec[key] ? " (spec)" : "");
  console.log(`grid ${set.grid}  ${set.count} icon${set.count > 1 ? "s" : ""}  stroke ${set.stroke ?? set.weight ?? "-"}${from("stroke")}  cut ${set.cut ?? "-"}${from("cut")}  smallest gap allowed ${set.gap}${from("gap")}  filled size ${set.size.filled.toFixed(2)}  line size ${set.size.line.toFixed(2)}`);
}
for (const line of disagree) console.log(line);
console.log("");
console.log(`${"icon".padEnd(width)}  kind    w x h          box centre    weight centre  ink   gaps 2x/1x  thinnest gap  strokes`);
for (const i of icons) {
  if (i.error) { console.log(`${i.name.padEnd(width)}  ${i.error}`); continue; }
  const strokes = [i.strokes.ink.join("/") || (i.weight !== null ? `~${round(i.weight)}` : "-"), i.strokes.cut.length ? `cut ${i.strokes.cut.join("/")}` : "", i.strokes.knock.length ? `knockout ${i.strokes.knock.join("/")}` : ""].filter(Boolean).join("  ");
  const gaps = i.counters.full ? `${i.counters.retina}/${i.counters.screen} of ${i.counters.full}` : "-";
  const sign = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
  console.log(`${i.name.padEnd(width)}  ${i.kind.padEnd(6)}  ${f(i.w)} x ${f(i.h)}  ${sign(i.offset[0])}, ${sign(i.offset[1])}  ${sign(i.massOffset[0])}, ${sign(i.massOffset[1])}   ${String(Math.round(i.ink * 100)).padStart(3)}%  ${gaps.padEnd(10)}  ${(i.gap === null ? "-" : i.gap.toFixed(2)).padEnd(12)}  ${strokes}`);
}
const layered = icons.filter((i) => i.base && i.baseKept >= 0.5);
if (layered.length) console.log("");
for (const i of layered) console.log(`${i.name} is ${i.base} with a layer: ${Math.round(i.baseKept * 100)}% of ${i.base}'s outline is in place, and ${i.base} carries the centre`);
const accepted = icons.filter((i) => i.accepted.length);
if (accepted.length) console.log(`\n${accepted.length} accepted from ${exceptionsPath}:`);
for (const i of accepted) for (const a of i.accepted) console.log(`  ${i.name}: ${a.text}. ${a.reason}`);
for (const line of invalid) console.log(`\ninvalid: ${line}`);
if (stale.length) console.log(`\n${stale.length} stale exception${stale.length > 1 ? "s" : ""}, no longer measured; remove or update:`);
for (const e of stale) console.log(`  ${e.icon}: ${e.check} ${JSON.stringify(e.value)}`);
const flagged = icons.filter((i) => i.flags.length);
console.log(flagged.length ? `\n${flagged.length} flagged:` : "\nnothing flagged");
for (const i of flagged) console.log(`  ${i.name}: ${i.flags.map((flag) => flag.text).join("; ")}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "report.json"), JSON.stringify({
  grid, sets: [...sets.values()], disagree, invalid, stale,
  icons: icons.map(({ markup, picture, lines, lineCuts, disc, ...rest }) => rest),
}, null, 2));

// Sheets. Each icon is an <img> of its own markup, so ids never collide.
const src = (i, colour) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colour ? i.markup.replace('color="#000"', `color="${colour}"`) : i.markup)}`;
const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const shoot = async (html, path, viewportWidth) => {
  const sheetPage = await browser.newPage({ viewport: { width: viewportWidth, height: 100 }, deviceScaleFactor: 2 });
  await sheetPage.setContent(html);
  await sheetPage.evaluate(async () => {
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
    for (const canvas of document.querySelectorAll("canvas[data-src]")) {
      const img = new Image();
      img.src = canvas.dataset.src;
      await img.decode().catch(() => null);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  });
  await sheetPage.screenshot({ path, fullPage: true });
  await sheetPage.close();
};
// Keylines for a grid: the live area and, inside it, the circle, square, wide and tall boxes that weigh the same.
const half = (n) => Math.round(n * 2) / 2;
const keylines = (g) => {
  const margin = half(g / 12), live = g - margin * 2, square = half((live * 12) / 13), short = half((live * 10.5) / 13);
  const box = (w, h) => `<rect x="${(g - w) / 2}" y="${(g - h) / 2}" width="${w}" height="${h}"/>`;
  return `<svg class="keys" viewBox="0 0 ${g} ${g}" fill="none" stroke-width="${g / 144}"><g stroke="#0ea5e9">${box(live, live)}<circle cx="${g / 2}" cy="${g / 2}" r="${live / 2}"/></g><g stroke="#d946ef">${box(square, square)}${box(live, short)}${box(short, live)}</g></svg>`;
};
const cell = (i) => {
  const d = i.display;
  const base = i.base && drawn.find((other) => other.name === i.base && other.grid === i.grid);
  const mark = i.flags.length ? "#c2410c" : i.accepted.length ? "#2563eb" : "#52525b";
  const notes = [...i.flags.map((flag) => flag.text), ...i.accepted.map((a) => `accepted: ${a.check}`)];
  return `<figure>
<div class="views">
<div class="big" style="background-size:${144 / i.own}px ${144 / i.own}px">${base ? `<img class="ghost" src="${src(base, "#f87171")}" width="144" height="144">` : ""}<img src="${src(i)}" width="144" height="144">${keylines(i.own)}</div>
<canvas data-src="${src(i)}" width="${d}" height="${d}" style="width:${d * 4}px;height:${d * 4}px"></canvas>
<div class="real"><img src="${src(i)}" width="${d}" height="${d}"><img src="${src(i)}" width="${d * 2}" height="${d * 2}"></div>
</div>
<figcaption style="color:${mark}"><b>${escape(i.name)}</b>${notes.length ? `<span>${escape(notes.join("; "))}</span>` : ""}</figcaption>
</figure>`;
};
const sheetStyle = `<style>
body{margin:20px;background:#fff;font:11px/1.35 system-ui,sans-serif;color:#52525b}
p{margin:0 0 16px}
main{display:grid;grid-template-columns:repeat(4,300px);gap:22px 16px}
figure{margin:0;display:flex;flex-direction:column;gap:6px;min-width:0}
.views{display:flex;align-items:center;gap:14px;height:148px}
.big{width:144px;height:144px;flex:none;outline:1px solid #d4d4d8;position:relative;background-image:linear-gradient(to right,#ececef 1px,transparent 1px),linear-gradient(to bottom,#ececef 1px,transparent 1px)}
.big::before,.big::after{content:"";position:absolute;background:#f0a5a5}
.big::before{left:72px;top:0;width:1px;height:144px}
.big::after{top:72px;left:0;height:1px;width:144px}
.big img{position:absolute;left:0;top:0;z-index:1;display:block}
.big img.ghost{opacity:.6}
.big .keys{position:absolute;left:0;top:0;width:144px;height:144px;z-index:2;opacity:.9}
canvas{image-rendering:pixelated;outline:1px solid #e4e4e7}
.real{display:flex;flex-direction:column;align-items:center;gap:10px}
figcaption b{font-weight:600}
figcaption span{display:block;font-size:10px}
</style>`;
const perSheet = 24;
const sheets = [];
for (let start = 0; start < drawn.length; start += perSheet) {
  const file = join(out, start ? `sheet-${start / perSheet + 1}.png` : "sheet.png");
  const legend = "Each icon: large on its grid with the centre lines and the keylines (blue: live area and circle; pink: square, wide and tall boxes of the same weight), as the pixels of a 1x screen at its real size, and at real size on 1x and 2x. Under an icon with a badge or slash, red is ink of its base that the icon no longer has.";
  await shoot(`<!doctype html>${sheetStyle}<p>${legend}</p><main>${drawn.slice(start, start + perSheet).map(cell).join("")}</main>`, file, 1300);
  sheets.push(file);
}

const themes = [["#ffffff", "#18181b", "#52525b", "#e4e4e7"], ["#0a0a0b", "#fafafa", "#a1a1aa", "#27272a"]];
const rowsStyle = `<style>
body{margin:20px;background:#fff;font:13px/1.2 system-ui,sans-serif;display:flex;gap:20px;align-items:flex-start}
section{padding:16px;border-radius:10px;width:540px;box-sizing:border-box}
.bar{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.bar span{width:28px;height:28px;display:grid;place-items:center;border-radius:6px}
.bar span:nth-child(3n+1){background:var(--line)}
.list{columns:3;column-gap:12px}
.list div{display:flex;align-items:center;gap:8px;height:28px;break-inside:avoid;white-space:nowrap;overflow:hidden}
img{display:block;flex:none}
</style>`;
const perRows = 60;
const rowSheets = [];
for (let start = 0; start < drawn.length; start += perRows) {
  const group = drawn.slice(start, start + perRows);
  const panel = ([paper, text, soft, line]) => `<section style="background:${paper};color:${text};--line:${line}">
<div class="bar">${group.map((i) => `<span><img src="${src(i, text)}" width="${i.display}" height="${i.display}"></span>`).join("")}</div>
<div class="list">${group.map((i) => `<div><img src="${src(i, soft)}" width="${i.display}" height="${i.display}">${escape(i.name)}</div>`).join("")}</div>
</section>`;
  const file = join(out, start ? `rows-${start / perRows + 1}.png` : "rows.png");
  await shoot(`<!doctype html>${rowsStyle}${themes.map(panel).join("")}`, file, 1140);
  rowSheets.push(file);
}
await browser.close();
console.log(`\nwrote ${join(out, "report.json")}, ${sheets.concat(rowSheets).join(", ")}`);
process.exit(flagged.length || disagree.length || stale.length || invalid.length ? 1 : 0);
